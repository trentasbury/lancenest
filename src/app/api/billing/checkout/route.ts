import { NextResponse, type NextRequest } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CATALOG, stripe, type ProductKey } from '@/lib/stripe';

/** Starts a Stripe Checkout for an employer plan, an extra job slot, or a job boost. */
export async function POST(request: NextRequest) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, '');
  const form = await request.formData();
  const product = String(form.get('product') ?? '') as ProductKey;
  const item = CATALOG[product];
  const session = await getSessionProfile();
  if (!session) return NextResponse.redirect(`${site}/login?next=/employers`, 303);
  if (!item) return NextResponse.redirect(`${site}/employer/dashboard?error=product`, 303);
  if (session.profile?.role !== 'employer') return NextResponse.redirect(`${site}/employers`, 303);

  const supabase = createClient();
  const { data: company } = await supabase.from('companies').select('id, name, stripe_customer_id').eq('owner_id', session.user.id).maybeSingle();
  if (!company) return NextResponse.redirect(`${site}/employer/dashboard?error=company`, 303);

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

  const metadata: Record<string, string> = { company_id: company.id as string, kind: item.kind, product };
  if (item.plan) metadata.plan = item.plan;
  if (jobId) metadata.job_id = jobId;

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
    allow_promotion_codes: true,
    success_url: `${site}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: jobId ? `${site}/employer/jobs/${jobId}` : `${site}/employer/dashboard`,
  });
  return NextResponse.redirect(checkout.url!, 303);
}
