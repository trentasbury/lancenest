import 'server-only';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { BOOST_DAYS, CONTACT_PACK_SIZE, stripe } from '@/lib/stripe';

const ACTIVE = new Set(['active', 'trialing', 'past_due']);

function periodEnd(sub: Stripe.Subscription): string | null {
  const s = sub as unknown as { current_period_end?: number; items?: { data?: { current_period_end?: number }[] } };
  const ts = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

/** Recomputes a company's plan and extra slots from its subscriptions (highest active plan wins). */
export const REFERRAL_CREDIT_CENTS = 24900;

export async function recomputeCompany(companyId: string) {
  const admin = createAdminClient();
  const { data: subs } = await admin.from('subscriptions').select('kind, plan, status').eq('company_id', companyId);
  const live = (subs ?? []).filter((s) => ACTIVE.has(s.status as string));
  const plans = live.filter((s) => s.kind === 'plan').map((s) => s.plan as string);
  const plan = plans.includes('enterprise') ? 'enterprise' : plans.includes('federal') ? 'federal' : plans.includes('professional') ? 'professional' : 'free';
  const slots = live.filter((s) => s.kind === 'job_slot').length;
  await admin.from('companies').update({ plan, extra_job_slots: slots, training_listing_active: plans.includes('training'), training_featured: plans.includes('training') && plans.includes('training_featured') }).eq('id', companyId);

  // Employer referral: the first time a referred company is on a paid plan, the referring company earns one Professional month.
  if (plan !== 'free') {
    const { data: me } = await admin.from('companies').select('owner_id, name, referral_rewarded_at').eq('id', companyId).maybeSingle();
    const { data: owner } = me && !me.referral_rewarded_at ? await admin.from('profiles').select('referred_by').eq('id', me.owner_id).maybeSingle() : { data: null };
    const { data: ref } = owner?.referred_by ? await admin.from('companies').select('id, owner_id, stripe_customer_id, referral_credit_cents').eq('owner_id', owner.referred_by).maybeSingle() : { data: null };
    if (me && ref && ref.id !== companyId) {
      await admin.from('companies').update({ referral_rewarded_at: new Date().toISOString() }).eq('id', companyId).is('referral_rewarded_at', null);
      if (ref.stripe_customer_id) {
        await stripe().customers.createBalanceTransaction(ref.stripe_customer_id as string, { amount: -REFERRAL_CREDIT_CENTS, currency: 'usd', description: `Referral credit: ${me.name} joined LanceNest` }, { idempotencyKey: `referral-${companyId}` });
      } else {
        await admin.from('companies').update({ referral_credit_cents: (ref.referral_credit_cents as number) + REFERRAL_CREDIT_CENTS }).eq('id', ref.id);
      }
      const { notifyMember } = await import('@/lib/email');
      await notifyMember(ref.owner_id as string, { type: 'referral', link: '/employer/dashboard', title: `${me.name} joined LanceNest on your referral — a $249 credit (one Professional month) is on your account. Thank you.` });
    }
  }
  // Back on Free: keep the newest (2 + slots) open jobs, pause the rest. Nothing is deleted.
  if (plan === 'free') {
    const { data: open } = await admin.from('jobs').select('id').eq('company_id', companyId).eq('status', 'open').order('posted_at', { ascending: false });
    const extra = (open ?? []).slice(2 + slots).map((j) => j.id as string);
    if (extra.length) await admin.from('jobs').update({ status: 'paused' }).in('id', extra);
  }
}

/** Upserts one Stripe subscription into our table, then refreshes the company's entitlements. */
export async function syncSubscription(sub: Stripe.Subscription) {
  const admin = createAdminClient();
  const companyId = sub.metadata?.company_id;
  const profileId = sub.metadata?.profile_id;
  if (!companyId && !profileId) return;
  const kind = sub.metadata?.kind === 'job_slot' ? 'job_slot' : 'plan';
  await admin.from('subscriptions').upsert(
    {
      company_id: companyId ?? null,
      profile_id: profileId ?? null,
      kind,
      plan: kind === 'job_slot' ? 'job_slot' : sub.metadata?.plan ?? 'professional',
      status: sub.status,
      stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      current_period_end: periodEnd(sub),
      founding: sub.metadata?.founding === 'true',
    },
    { onConflict: 'stripe_subscription_id' },
  );
  if (companyId) await recomputeCompany(companyId);
  else if (profileId) await recomputeVeteran(profileId);
}

const VET_RANK: Record<string, [number, string]> = { veteran_federal_pro: [3, 'federal_pro'], veteran_pro_plus: [2, 'pro_plus'], veteran_pro: [1, 'pro'] };
/** A member's plan is the best one among their active subscriptions (free if none). */
export async function recomputeVeteran(profileId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from('subscriptions').select('plan').eq('profile_id', profileId).in('status', ['active', 'trialing', 'past_due']);
  const best = (data ?? []).map((r) => VET_RANK[r.plan as string]).filter(Boolean).sort((a, b) => b[0] - a[0])[0];
  const { data: grant } = best ? { data: null } : await admin.from('veteran_profiles').select('pro_granted_until').eq('profile_id', profileId).maybeSingle();
  const granted = grant?.pro_granted_until && Date.parse(grant.pro_granted_until as string) > Date.now();
  await admin.from('veteran_profiles').update({ plan: best ? best[1] : granted ? 'pro' : 'free' }).eq('profile_id', profileId);
}

/** Applies a completed Checkout Session. Safe to call more than once (webhook + success page). */
export async function applyCheckoutSession(sessionId: string) {
  const s = await stripe().checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });
  if (s.status !== 'complete') return { ok: false as const };
  const kind = s.metadata?.kind;
  if (kind === 'milestone') {
    const { fundMilestoneFromSession } = await import('@/lib/payments');
    return fundMilestoneFromSession(sessionId);
  }

  if (s.mode === 'subscription' && s.subscription && typeof s.subscription !== 'string') {
    await syncSubscription(s.subscription);
    return { ok: true as const, kind };
  }

  if (kind === 'job_boost' && s.payment_status === 'paid') {
    const admin = createAdminClient();
    const jobId = s.metadata?.job_id;
    const { data: already } = await admin.from('purchases').select('id').eq('stripe_checkout_session_id', s.id).maybeSingle();
    if (!already && jobId) {
      const { data: job } = await admin.from('jobs').select('featured_until').eq('id', jobId).maybeSingle();
      // Boosts stack: a second boost extends from the current end date.
      const base = job?.featured_until && new Date(job.featured_until) > new Date() ? new Date(job.featured_until) : new Date();
      base.setDate(base.getDate() + BOOST_DAYS);
      await admin.from('jobs').update({ featured_until: base.toISOString() }).eq('id', jobId);
      await admin.from('purchases').insert({
        company_id: s.metadata?.company_id ?? null, kind: 'job_boost', job_id: jobId,
        amount_cents: s.amount_total ?? 0, stripe_checkout_session_id: s.id,
      });
    }
    return { ok: true as const, kind };
  }
  if (kind === 'fair_booth' && s.payment_status === 'paid') {
    const admin = createAdminClient();
    const companyId = s.metadata?.company_id;
    const { error } = await admin.from('purchases').insert({ company_id: companyId ?? null, kind: 'fair_booth', amount_cents: s.amount_total ?? 0, stripe_checkout_session_id: s.id });
    if (!error && companyId && s.metadata?.fair_id) {
      await admin.from('fair_booths').insert({ fair_id: s.metadata.fair_id, company_id: companyId, pitch: s.metadata.pitch || null, video_url: s.metadata.video_url || null, stripe_checkout_session_id: s.id });
    }
    return { ok: true as const, kind };
  }
  if (kind === 'training_webinar' && s.payment_status === 'paid') {
    const admin = createAdminClient();
    const companyId = s.metadata?.company_id;
    const { error } = await admin.from('purchases').insert({ company_id: companyId ?? null, kind: 'training_webinar', amount_cents: s.amount_total ?? 0, stripe_checkout_session_id: s.id });
    if (!error && companyId) {
      await admin.from('training_events').insert({ company_id: companyId, title: s.metadata?.event_title ?? 'Info session', starts_at: s.metadata?.event_starts_at, url: s.metadata?.event_url, stripe_checkout_session_id: s.id });
    }
    return { ok: true as const, kind };
  }
  if (kind === 'contact_pack' && s.payment_status === 'paid') {
    const admin = createAdminClient();
    const companyId = s.metadata?.company_id;
    const { error } = await admin.from('purchases').insert({
      company_id: companyId ?? null, kind: 'contact_credits', amount_cents: s.amount_total ?? 0, stripe_checkout_session_id: s.id,
    });
    // The unique session id makes this run once even if Stripe and the success page both apply it.
    if (!error && companyId) {
      const { data: c } = await admin.from('companies').select('contact_credits').eq('id', companyId).maybeSingle();
      await admin.from('companies').update({ contact_credits: (c?.contact_credits ?? 0) + CONTACT_PACK_SIZE }).eq('id', companyId);
    }
    return { ok: true as const, kind };
  }
  return { ok: false as const };
}

/** How many of the 50 Founding Employer spots are left (each company counts once, even if it later cancels). */
export async function foundingSpotsLeft() {
  const { data } = await createAdminClient().from('subscriptions').select('company_id').eq('founding', true);
  const used = new Set((data ?? []).map((r) => r.company_id as string)).size;
  return Math.max(50 - used, 0);
}
