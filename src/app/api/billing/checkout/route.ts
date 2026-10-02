import { NextResponse, type NextRequest } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CATALOG, foundingCoupon, foundingFederalCoupon, publicSafetyCoupon, stripe, type ProductKey } from '@/lib/stripe';
import { foundingSpotsLeft } from '@/lib/billing';

/** Starts a Stripe Checkout for an employer plan, an extra job slot, or a job boost. */
export async function POST(request: NextRequest) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, '');
  const form = await request.formData();
  let product = String(form.get('product') ?? '') as ProductKey;
  let item = CATALOG[product];
  const session = await getSessionProfile();
  if (!session) return NextResponse.redirect(`${site}/login?next=/employers`, 303);
  if (!item) return NextResponse.redirect(`${site}/employer/dashboard?error=product`, 303);
  if (item.audience === 'veteran') {
    // Member plans: verified service members only; one Stripe customer per member (stored server-side only).
    if (session.profile?.role !== 'veteran') return NextResponse.redirect(`${site}/plans`, 303);
    const { data: vet } = await createClient().from('veteran_profiles').select('verification_status').eq('profile_id', session.user.id).maybeSingle();
    if (vet?.verification_status !== 'verified') return NextResponse.redirect(`${site}/dashboard/verification?required=1`, 303);
    const admin = createAdminClient();
    const { data: bc } = await admin.from('billing_customers').select('stripe_customer_id').eq('profile_id', session.user.id).maybeSingle();
    let customer = bc?.stripe_customer_id as string | undefined;
    if (!customer) {
      customer = (await stripe().customers.create({ email: session.user.email, name: session.profile?.full_name ?? undefined, metadata: { profile_id: session.user.id } })).id;
      await admin.from('billing_customers').insert({ profile_id: session.user.id, stripe_customer_id: customer });
    }
    const meta = { profile_id: session.user.id, kind: 'plan', plan: item.plan as string, product };
    const checkout = await stripe().checkout.sessions.create({
      mode: 'subscription', customer, allow_promotion_codes: true,
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: item.amount, recurring: { interval: item.interval! }, product_data: { name: item.name } } }],
      subscription_data: { metadata: meta }, metadata: meta,
      success_url: `${site}/billing/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${site}/plans`,
    });
    return NextResponse.redirect(checkout.url!, 303);
  }
  if (session.profile?.role !== 'employer') return NextResponse.redirect(`${site}/employers`, 303);

  const supabase = createClient();
  const { data: company } = await supabase.from('companies').select('id, name, stripe_customer_id, is_verified, public_safety_status, training_listing_active').eq('owner_id', session.user.id).maybeSingle();
  if (!company) return NextResponse.redirect(`${site}/employer/dashboard?error=company`, 303);
  if (!company.is_verified) return NextResponse.redirect(`${site}/employer/dashboard?error=verify`, 303);

  let jobId: string | null = null;
  if (item.kind === 'job_boost') {
    jobId = String(form.get('job_id') ?? '');
    const { data: job } = await supabase.from('jobs').select('id').eq('id', jobId).eq('company_id', company.id).maybeSingle();
    if (!job) return NextResponse.redirect(`${site}/employer/dashboard?error=job`, 303);
  }

  // One Stripe customer per company, created on first purchase.
  let customerId = company.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe().customers.create({ name: company.name as string, email: session.user.email, metadata: { company_id: company.id as string } });
    customerId = customer.id;
    await createAdminClient().from('companies').update({ stripe_customer_id: customerId }).eq('id', company.id);
  }
  // Referral credit earned before this company had a Stripe account: apply it now (Stripe uses it on the next invoice).
  const { data: credit } = await createAdminClient().from('companies').select('referral_credit_cents').eq('id', company.id).maybeSingle();
  if ((credit?.referral_credit_cents as number) > 0) {
    await stripe().customers.createBalanceTransaction(customerId, { amount: -(credit!.referral_credit_cents as number), currency: 'usd', description: 'LanceNest referral credit' });
    await createAdminClient().from('companies').update({ referral_credit_cents: 0 }).eq('id', company.id);
  }

  if (item.kind === 'shortlist') {
    const { data: planRow } = await createAdminClient().from('companies').select('plan').eq('id', company.id).maybeSingle();
    product = (['professional', 'federal', 'enterprise'].includes(planRow?.plan as string) ? 'shortlist_member' : 'shortlist') as typeof product;
    item = CATALOG[product];
  }
  if (item.kind === 'fair_booth') {
    const { data: planRow } = await createAdminClient().from('companies').select('plan').eq('id', company.id).maybeSingle();
    product = (['professional', 'federal', 'enterprise'].includes(planRow?.plan as string) ? 'fair_booth_member' : 'fair_booth') as typeof product;
    item = CATALOG[product];
  }
  const metadata: Record<string, string> = { company_id: company.id as string, kind: item.kind, product };
  if (item.plan) metadata.plan = item.plan;
  if (item.plan === 'training_featured' && !company.training_listing_active) return NextResponse.redirect(`${site}/employer/training?error=listing_first`, 303);
  if (item.kind === 'shortlist') {
    const f = (k: string, max: number) => String(form.get(k) ?? '').trim().slice(0, max);
    const engagement = f('engagement', 20);
    const role = f('role_title', 140);
    if (role.length < 3) return NextResponse.redirect(`${site}/employer/shortlists?error=role`, 303);
    const { data: req } = await createAdminClient().from('shortlist_requests').insert({
      company_id: company.id, requested_by: session.user.id, role_title: role,
      engagement: ['full_time', 'contract', 'contract_to_hire'].includes(engagement) ? engagement : 'full_time',
      clearance_required: f('clearance_required', 20) || 'none', location: f('location', 120) || null, pay: f('pay', 120) || null, details: f('details', 3000) || null,
    }).select('id').single();
    if (!req) return NextResponse.redirect(`${site}/employer/shortlists?error=save`, 303);
    metadata.request_id = req.id as string;
    // Federal and Enterprise include one free Verified Shortlist per calendar quarter.
    const { data: planRow2 } = await createAdminClient().from('companies').select('plan').eq('id', company.id).maybeSingle();
    if (['federal', 'enterprise'].includes(planRow2?.plan as string)) {
      const now = new Date(), qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString();
      const { count } = await createAdminClient().from('shortlist_requests').select('id', { count: 'exact', head: true })
        .eq('company_id', company.id).eq('amount_cents', 0).neq('status', 'awaiting_payment').gte('created_at', qStart);
      if (!count) {
        const due = new Date(); let added = 0;
        while (added < 3) { due.setDate(due.getDate() + 1); if (due.getDay() !== 0 && due.getDay() !== 6) added++; }
        await createAdminClient().from('shortlist_requests').update({ status: 'sourcing', amount_cents: 0, due_at: due.toISOString() }).eq('id', req.id);
        const { data: admins } = await createAdminClient().from('profiles').select('id').eq('role', 'admin');
        if (admins?.length) await createAdminClient().from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'shortlist', title: 'New shortlist request (included with Federal) — due in 3 business days.', link: '/admin/shortlists' })));
        return NextResponse.redirect(`${site}/employer/shortlists?free=1`, 303);
      }
    }
  }
  if (item.kind === 'fair_booth') {
    const fairId = String(form.get('fair_id') ?? '');
    const { data: fair } = await createAdminClient().from('career_fairs').select('id, slug, starts_at').eq('id', fairId).maybeSingle();
    if (!fair || Date.parse(fair.starts_at as string) < Date.now()) return NextResponse.redirect(`${site}/fairs`, 303);
    const { data: owned } = await createAdminClient().from('fair_booths').select('id').eq('fair_id', fairId).eq('company_id', company.id).maybeSingle();
    if (owned) return NextResponse.redirect(`${site}/fairs/${fair.slug}`, 303);
    const video = String(form.get('video_url') ?? '').trim().slice(0, 300);
    Object.assign(metadata, { fair_id: fairId, fair_slug: fair.slug as string, pitch: String(form.get('pitch') ?? '').trim().slice(0, 450), video_url: /^https:\/\//i.test(video) ? video : '' });
  }
  if (item.kind === 'training_webinar') {
    const title = String(form.get('event_title') ?? '').trim().slice(0, 140);
    const startsAt = new Date(String(form.get('event_starts_at') ?? ''));
    const url = String(form.get('event_url') ?? '').trim().slice(0, 300);
    if (title.length < 4 || Number.isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now() + 86400000 || !/^https:\/\//i.test(url)) {
      return NextResponse.redirect(`${site}/employer/training?error=event`, 303);
    }
    Object.assign(metadata, { event_title: title, event_starts_at: startsAt.toISOString(), event_url: url });
  }

  // Founding Employer discount (first 12 months) while spots remain. Stripe applies it, then the
  // subscription renews at the standard price automatically.
  let coupon: string | null = null;
  // Approved public-safety agencies get 30% off Professional/Federal (better than, and instead of, the Founding offer).
  if ((item.plan === 'professional' || item.plan === 'federal') && company.public_safety_status === 'approved') {
    coupon = await publicSafetyCoupon();
    metadata.public_safety = 'true';
  } else if ((item.plan === 'professional' || item.plan === 'federal') && item.interval && (await foundingSpotsLeft()) > 0) {
    coupon = item.plan === 'federal' ? await foundingFederalCoupon(item.interval) : await foundingCoupon(item.interval);
    metadata.founding = 'true';
  }

  const checkout = await stripe().checkout.sessions.create({
    mode: item.interval ? 'subscription' : 'payment',
    customer: customerId,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: item.amount,
        product_data: { name: item.name },
        ...(item.interval ? { recurring: { interval: item.interval } } : {}),
      },
    }],
    metadata,
    ...(item.interval ? { subscription_data: { metadata } } : {}),
    // Stripe allows either a pre-applied discount or customer-entered promo codes, not both.
    ...(coupon ? { discounts: [{ coupon }] } : { allow_promotion_codes: true }),
    success_url: `${site}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: jobId ? `${site}/employer/jobs/${jobId}` : `${site}/employer/dashboard`,
  });
  return NextResponse.redirect(checkout.url!, 303);
}
