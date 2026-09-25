import 'server-only';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { BOOST_DAYS, stripe } from '@/lib/stripe';

const ACTIVE = new Set(['active', 'trialing', 'past_due']);

function periodEnd(sub: Stripe.Subscription): string | null {
  const s = sub as unknown as { current_period_end?: number; items?: { data?: { current_period_end?: number }[] } };
  const ts = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

/** Recomputes a company's plan and extra slots from its subscriptions (highest active plan wins). */
export async function recomputeCompany(companyId: string) {
  const admin = createAdminClient();
  const { data: subs } = await admin.from('subscriptions').select('kind, plan, status').eq('company_id', companyId);
  const live = (subs ?? []).filter((s) => ACTIVE.has(s.status as string));
  const plans = live.filter((s) => s.kind === 'plan').map((s) => s.plan as string);
  const plan = plans.includes('enterprise') ? 'enterprise' : plans.includes('federal') ? 'federal' : plans.includes('professional') ? 'professional' : 'free';
  const slots = live.filter((s) => s.kind === 'job_slot').length;
  await admin.from('companies').update({ plan, extra_job_slots: slots }).eq('id', companyId);
}

/** Upserts one Stripe subscription into our table, then refreshes the company's entitlements. */
export async function syncSubscription(sub: Stripe.Subscription) {
  const admin = createAdminClient();
  const companyId = sub.metadata?.company_id;
  if (!companyId) return;
  const kind = sub.metadata?.kind === 'job_slot' ? 'job_slot' : 'plan';
  await admin.from('subscriptions').upsert(
    {
      company_id: companyId,
      kind,
      plan: kind === 'job_slot' ? 'job_slot' : sub.metadata?.plan ?? 'professional',
      status: sub.status,
      stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      current_period_end: periodEnd(sub),
    },
    { onConflict: 'stripe_subscription_id' },
  );
  await recomputeCompany(companyId);
}

/** Applies a completed Checkout Session. Safe to call more than once (webhook + success page). */
export async function applyCheckoutSession(sessionId: string) {
  const s = await stripe().checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });
  if (s.status !== 'complete') return { ok: false as const };
  const kind = s.metadata?.kind;

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
  return { ok: false as const };
}
