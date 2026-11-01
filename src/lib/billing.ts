import 'server-only';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { BOOST_DAYS, CONTACT_PACK_SIZE, PROPOSAL_PACK_SIZE, stripe } from '@/lib/stripe';
import { SEATS } from '@/lib/employer';

const ACTIVE = new Set(['active', 'trialing', 'past_due']);

/**
 * A failed payment keeps paid features for 7 days (Stripe retries the card meanwhile), then they pause until the
 * payment goes through; paying restores them automatically (approved November 1, 2026).
 */
export const PAYMENT_GRACE_DAYS = 7;
type SubRow = { status: string | null; past_due_since?: string | null };
/** Does this subscription currently pay for its features? */
export function subscriptionCounts(s: SubRow) {
  if (s.status === 'active' || s.status === 'trialing') return true;
  if (s.status !== 'past_due') return false;
  const since = s.past_due_since ? Date.parse(s.past_due_since) : Date.now();
  return Date.now() - since < PAYMENT_GRACE_DAYS * 86400000;
}

function periodEnd(sub: Stripe.Subscription): string | null {
  const s = sub as unknown as { current_period_end?: number; items?: { data?: { current_period_end?: number }[] } };
  const ts = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

/** Recomputes a company's plan and extra slots from its subscriptions (highest active plan wins). */
export async function recomputeCompany(companyId: string) {
  const admin = createAdminClient();
  const { data: subs } = await admin.from('subscriptions').select('kind, plan, status, past_due_since').eq('company_id', companyId);
  const live = (subs ?? []).filter((s) => subscriptionCounts(s as SubRow));
  const plans = live.filter((s) => s.kind === 'plan').map((s) => s.plan as string);
  const plan = plans.includes('enterprise') ? 'enterprise' : plans.includes('federal') ? 'federal' : plans.includes('professional') ? 'professional' : plans.includes('starter') ? 'starter' : 'free';
  const slots = live.filter((s) => s.kind === 'job_slot').length;
  await admin.from('companies').update({ plan, extra_job_slots: slots, training_listing_active: plans.includes('training'), training_featured: plans.includes('training') && plans.includes('training_featured') }).eq('id', companyId);

  if (plan !== 'free') {
    const { data: co } = await admin.from('companies').select('owner_id').eq('id', companyId).maybeSingle();
    if (co) { const { rewardReferrer } = await import('@/lib/referrals'); await rewardReferrer(co.owner_id as string, 'company_paid'); }
  }

  // After any downgrade, apply the new plan's limits. Jobs over the limit are paused (newest stay open; nothing is
  // deleted). Teammates over the seat limit lose access (earliest added stay); the owner can add them back after upgrading.
  const jobCap = plan === 'free' ? 3 : plan === 'starter' ? 10 : plan === 'professional' ? 25 : null;
  if (jobCap !== null) {
    const { data: open } = await admin.from('jobs').select('id').eq('company_id', companyId).eq('status', 'open').neq('employment_type', 'skillbridge').order('posted_at', { ascending: false });
    const extra = (open ?? []).slice(jobCap + slots).map((j) => j.id as string);
    if (extra.length) await admin.from('jobs').update({ status: 'paused' }).in('id', extra);
  }
  const { data: members } = await admin.from('company_members').select('profile_id').eq('company_id', companyId).order('created_at');
  const overSeats = (members ?? []).slice(Math.max((SEATS[plan] ?? 1) - 1, 0)).map((m) => m.profile_id as string);
  if (overSeats.length) {
    await admin.from('company_members').delete().eq('company_id', companyId).in('profile_id', overSeats);
    const { data: co } = await admin.from('companies').select('owner_id').eq('id', companyId).maybeSingle();
    if (co) await admin.from('notifications').insert({ profile_id: co.owner_id, type: 'billing', title: `Your plan now includes ${SEATS[plan] ?? 1} seat${(SEATS[plan] ?? 1) === 1 ? '' : 's'}, so ${overSeats.length} teammate${overSeats.length === 1 ? '' : 's'} lost access. Upgrade to add them back.`, link: '/employer/team' });
  }
}

/**
 * Upserts one Stripe subscription into our table, then refreshes the company's or member's entitlements.
 * Stripe can deliver (and retry) notices out of order, so the current state is always re-read from Stripe first:
 * an old "active" notice arriving after a cancellation can never switch a plan back on.
 */
export async function syncSubscription(event: Stripe.Subscription) {
  let sub = event;
  try { sub = await stripe().subscriptions.retrieve(event.id); }
  catch (err) { if ((err as { code?: string }).code !== 'resource_missing') throw err; sub = { ...event, status: 'canceled' } as Stripe.Subscription; }
  const admin = createAdminClient();
  const companyId = sub.metadata?.company_id;
  const profileId = sub.metadata?.profile_id;
  if (!companyId && !profileId) return;
  const kind = sub.metadata?.kind === 'job_slot' ? 'job_slot' : 'plan';
  const { data: before } = await admin.from('subscriptions').select('status, past_due_since').eq('stripe_subscription_id', sub.id).maybeSingle();
  const pastDueSince = sub.status === 'past_due' ? ((before?.past_due_since as string | null) ?? new Date().toISOString()) : null;
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
      past_due_since: pastDueSince,
    },
    { onConflict: 'stripe_subscription_id' },
  );
  // The Founding Employer rate is once per business: record the company's website domain the first time it's used.
  if (companyId && sub.metadata?.founding === 'true' && ACTIVE.has(sub.status)) {
    const { data: co } = await admin.from('companies').select('website').eq('id', companyId).maybeSingle();
    const { domainKey, claimPerk } = await import('@/lib/identityClaims');
    const key = domainKey(co?.website as string | null);
    if (key) await claimPerk(key, 'founding_employer', null);
  }
  // A payment just failed: tell them before anything pauses.
  if (sub.status === 'past_due' && before?.status !== 'past_due') await tellPaymentFailed(companyId ?? null, profileId ?? null);
  if (kind === 'plan' && ACTIVE.has(sub.status)) await endReplacedPlans(sub, companyId ?? null, profileId ?? null);
  if (companyId) await recomputeCompany(companyId);
  else if (profileId) await recomputeVeteran(profileId);
}

const EMPLOYER_PLANS = ['starter', 'professional', 'federal', 'enterprise'];
const MEMBER_PLANS = ['veteran_pro', 'veteran_pro_plus', 'veteran_federal_pro'];

/**
 * Switching plans (Starter → Professional, monthly → annual, Pro → Career Accelerator) starts a new subscription.
 * The older plan stops right away and the unused share of what was paid for it is credited to the account, so nobody
 * pays for two plans.
 * Add-ons (training listings, extra job slots) are separate and never touched.
 */
async function endReplacedPlans(sub: Stripe.Subscription, companyId: string | null, profileId: string | null) {
  const plan = sub.metadata?.plan ?? '';
  const group = EMPLOYER_PLANS.includes(plan) ? EMPLOYER_PLANS : MEMBER_PLANS.includes(plan) ? MEMBER_PLANS : null;
  if (!group) return;
  const admin = createAdminClient();
  let q = admin.from('subscriptions').select('stripe_subscription_id').eq('kind', 'plan').in('plan', group).in('status', [...ACTIVE]).neq('stripe_subscription_id', sub.id);
  q = companyId ? q.eq('company_id', companyId) : q.eq('profile_id', profileId!);
  const { data: others } = await q;
  for (const o of others ?? []) {
    try {
      const old = await stripe().subscriptions.retrieve(o.stripe_subscription_id as string);
      // The newest plan wins; an older event arriving late never cancels the plan that replaced it.
      if (old.created >= sub.created || !ACTIVE.has(old.status)) continue;
      // Credit for the unused time is based on what was actually paid for the current period, not the list price:
      // a discounted first year (Founding, Keep Pro) or an unpaid renewal never turns into extra account credit.
      const credit = await unusedPaidCents(old);
      await stripe().subscriptions.cancel(old.id, { prorate: false }, { idempotencyKey: `replaced-${old.id}` });
      if (credit > 0) {
        const customer = typeof old.customer === 'string' ? old.customer : old.customer.id;
        await stripe().customers.createBalanceTransaction(customer, { amount: -credit, currency: 'usd', description: 'Unused time on your previous LanceNest plan' }, { idempotencyKey: `replaced-credit-${old.id}` });
      }
      await admin.from('subscriptions').update({ status: 'canceled' }).eq('stripe_subscription_id', old.id);
    } catch (err) {
      console.error('could not end the replaced plan:', err);
    }
  }
}

/** The paid share of the current period that hasn't been used yet, in cents (0 if the period wasn't paid). */
async function unusedPaidCents(sub: Stripe.Subscription): Promise<number> {
  const invoiceId = typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice?.id;
  if (!invoiceId) return 0;
  const invoice = await stripe().invoices.retrieve(invoiceId);
  if (invoice.status !== 'paid' || !(invoice.amount_paid > 0)) return 0;
  // Refunded or disputed payments don't earn credit.
  const charge = (invoice as unknown as { charge?: string | Stripe.Charge | null }).charge;
  if (charge) {
    const c = typeof charge === 'string' ? await stripe().charges.retrieve(charge) : charge;
    if (c.refunded || c.disputed || (c.amount_refunded ?? 0) > 0) return 0;
  }
  const s = sub as unknown as { current_period_start?: number; current_period_end?: number; items?: { data?: { current_period_start?: number; current_period_end?: number }[] } };
  const start = s.current_period_start ?? s.items?.data?.[0]?.current_period_start ?? invoice.period_start;
  const end = s.current_period_end ?? s.items?.data?.[0]?.current_period_end ?? invoice.period_end;
  const now = Math.floor(Date.now() / 1000);
  if (!(end > start) || now >= end) return 0;
  const unused = Math.min(1, Math.max(0, (end - Math.max(now, start)) / (end - start)));
  return Math.floor(invoice.amount_paid * unused);
}

const VET_RANK: Record<string, [number, string]> = { veteran_federal_pro: [3, 'federal_pro'], veteran_pro_plus: [2, 'pro_plus'], veteran_pro: [1, 'pro'] };
/** A member's plan is the best one among their active subscriptions (free if none). */
export async function recomputeVeteran(profileId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from('subscriptions').select('plan, status, past_due_since').eq('profile_id', profileId).in('status', ['active', 'trialing', 'past_due']);
  const best = (data ?? []).filter((r) => subscriptionCounts(r as SubRow)).map((r) => VET_RANK[r.plan as string]).filter(Boolean).sort((a, b) => b[0] - a[0])[0];
  // Referral grants (Pro / Career Accelerator / Federal access) apply while active; the member gets whichever is higher.
  const { data: grant } = await admin.from('veteran_profiles').select('pro_granted_until, granted_plan').eq('profile_id', profileId).maybeSingle();
  const activeGrant = grant?.granted_plan && grant.pro_granted_until && Date.parse(grant.pro_granted_until as string) > Date.now() ? (grant.granted_plan as string) : null;
  const RANK: Record<string, number> = { free: 0, pro: 1, pro_plus: 2, federal_pro: 3 };
  const paidPlan = best ? best[1] : 'free';
  const plan = activeGrant && RANK[activeGrant] > RANK[paidPlan] ? activeGrant : paidPlan;
  await admin.from('veteran_profiles').update({ plan, ...(activeGrant ? {} : { granted_plan: null }) }).eq('profile_id', profileId);
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
  if (kind === 'booking') {
    if (s.payment_status !== 'paid' || !s.metadata?.contract_id) return { ok: false as const };
    const { confirmBookingFromSession } = await import('@/lib/booking');
    return confirmBookingFromSession(s.id, s.metadata.contract_id, s.amount_total ?? 0);
  }

  if (s.mode === 'subscription' && s.subscription && typeof s.subscription !== 'string') {
    await syncSubscription(s.subscription);
    return { ok: true as const, kind };
  }

  if (kind === 'job_boost' && s.payment_status === 'paid') {
    const admin = createAdminClient();
    const jobId = s.metadata?.job_id;
    // Record the purchase first: the unique session id means only one caller (webhook or success page) extends the boost.
    const { error: dup } = jobId ? await admin.from('purchases').insert({
      company_id: s.metadata?.company_id ?? null, kind: 'job_boost', job_id: jobId,
      amount_cents: s.amount_total ?? 0, stripe_checkout_session_id: s.id,
    }) : { error: true };
    if (!dup && jobId) {
      const { data: job } = await admin.from('jobs').select('featured_until').eq('id', jobId).maybeSingle();
      // Boosts stack: a second boost extends from the current end date.
      const base = job?.featured_until && new Date(job.featured_until) > new Date() ? new Date(job.featured_until) : new Date();
      base.setDate(base.getDate() + BOOST_DAYS);
      await admin.from('jobs').update({ featured_until: base.toISOString() }).eq('id', jobId);
    }
    return { ok: true as const, kind };
  }
  if (kind === 'proposal_pack' && s.payment_status === 'paid') {
    const profileId = s.metadata?.profile_id;
    // The database records the Stripe session once, so the webhook and the success page can both call this safely.
    if (profileId) await createAdminClient().rpc('apply_proposal_pack', { p_session: s.id, p_profile: profileId, p_credits: PROPOSAL_PACK_SIZE, p_amount: s.amount_total ?? 0 });
    return { ok: true as const, kind };
  }
  if (kind === 'shortlist' && s.payment_status === 'paid') {
    const admin = createAdminClient();
    const companyId = s.metadata?.company_id, requestId = s.metadata?.request_id;
    const { error } = await admin.from('purchases').insert({ company_id: companyId ?? null, kind: 'shortlist', amount_cents: s.amount_total ?? 0, stripe_checkout_session_id: s.id });
    if (!error && requestId) {
      // Due in 15 business days.
      const due = new Date(); let added = 0;
      while (added < 15) { due.setDate(due.getDate() + 1); if (due.getDay() !== 0 && due.getDay() !== 6) added++; }
      await admin.from('shortlist_requests').update({ status: 'sourcing', amount_cents: s.amount_total ?? 0, stripe_checkout_session_id: s.id, due_at: due.toISOString() }).eq('id', requestId).eq('status', 'awaiting_payment');
      const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
      if (admins?.length) await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'shortlist', title: 'New Search Sprint — up to 5 introductions due in 15 business days.', link: '/admin/shortlists' })));
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


/** In-app notice and email when a renewal payment fails (paid features pause after the grace period). */
async function tellPaymentFailed(companyId: string | null, profileId: string | null) {
  const admin = createAdminClient();
  let to = profileId;
  let link = '/plans';
  if (companyId) {
    const { data: co } = await admin.from('companies').select('owner_id').eq('id', companyId).maybeSingle();
    to = (co?.owner_id as string | undefined) ?? null;
    link = '/employer/dashboard';
  }
  if (!to) return;
  const { SITE, notifyMember } = await import('@/lib/email');
  const until = new Date(Date.now() + PAYMENT_GRACE_DAYS * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' });
  await notifyMember(to, { type: 'billing', link, title: `Your LanceNest payment didn’t go through. Update your card by ${until} to keep your paid features.`,
    email: { subject: 'Your LanceNest payment didn’t go through', preheader: `Update your card by ${until} to keep your plan.`, tone: 'alert', badge: 'Payment failed',
      heading: 'We couldn’t charge your card.',
      paragraphs: [`Your plan renewal didn’t go through. We’ll try again over the next few days, and your paid features stay on until ${until}.`,
        'After that they pause until the payment goes through, and they come back on their own as soon as it does. Nothing is deleted.'],
      cta: { label: 'Update your card', url: `${SITE}${link}` } } });
}

/**
 * Daily safety net (cron): re-checks with Stripe every subscription still marked paid whose renewal date has passed
 * or that is overdue, so a lost notice or an ended grace period never leaves paid features on.
 */
export async function reconcileSubscriptions() {
  const admin = createAdminClient();
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const [{ data: stale }, { data: overdue }] = await Promise.all([
    admin.from('subscriptions').select('stripe_subscription_id').in('status', ['active', 'trialing']).lt('current_period_end', dayAgo).limit(200),
    admin.from('subscriptions').select('stripe_subscription_id').eq('status', 'past_due').limit(200),
  ]);
  let checked = 0;
  for (const r of [...(stale ?? []), ...(overdue ?? [])]) {
    try {
      const sub = await stripe().subscriptions.retrieve(r.stripe_subscription_id as string);
      await syncSubscription(sub);
      checked++;
    } catch (err) {
      if ((err as { code?: string }).code === 'resource_missing') {
        const { data: row } = await admin.from('subscriptions').update({ status: 'canceled', past_due_since: null }).eq('stripe_subscription_id', r.stripe_subscription_id).select('company_id, profile_id').maybeSingle();
        if (row?.company_id) await recomputeCompany(row.company_id as string);
        else if (row?.profile_id) await recomputeVeteran(row.profile_id as string);
      } else console.error('subscription re-check failed:', err);
    }
  }
  return checked;
}

/**
 * A customer disputed a charge with their bank (chargeback). Their LanceNest subscriptions end right away, credits
 * bought with that payment are taken back, and admins are told what the payment was for.
 */
export async function handleDispute(dispute: Stripe.Dispute) {
  const admin = createAdminClient();
  const charge = typeof dispute.charge === 'string' ? await stripe().charges.retrieve(dispute.charge) : dispute.charge;
  const customer = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id ?? null;
  const pi = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id ?? null;
  let what = 'a subscription payment';

  // One-time purchases carry their checkout's metadata.
  if (pi) {
    const sessions = await stripe().checkout.sessions.list({ payment_intent: pi, limit: 1 });
    const meta = sessions.data[0]?.metadata ?? {};
    if (meta.kind) what = meta.kind.replace(/_/g, ' ');
    if (meta.kind === 'contact_pack' || meta.kind === 'contact_credits') {
      if (meta.company_id) {
        const { data: c } = await admin.from('companies').select('contact_credits').eq('id', meta.company_id).maybeSingle();
        await admin.from('companies').update({ contact_credits: Math.max(Number(c?.contact_credits ?? 0) - CONTACT_PACK_SIZE, 0) }).eq('id', meta.company_id);
      }
    }
    if (meta.kind === 'proposal_pack' && meta.profile_id) {
      const { data: c } = await admin.from('proposal_credits').select('credits').eq('profile_id', meta.profile_id).maybeSingle();
      if (c) await admin.from('proposal_credits').update({ credits: Math.max(Number(c.credits ?? 0) - PROPOSAL_PACK_SIZE, 0) }).eq('profile_id', meta.profile_id);
    }
  }

  // Every active LanceNest subscription on that customer ends now (no refund of the disputed period).
  if (customer) {
    const subs = await stripe().subscriptions.list({ customer, status: 'all', limit: 20 });
    for (const sub of subs.data) {
      if (!ACTIVE.has(sub.status)) continue;
      try { await stripe().subscriptions.cancel(sub.id, { prorate: false }, { idempotencyKey: `dispute-${dispute.id}-${sub.id}` }); } catch (err) { console.error('dispute cancel failed:', err); }
      await syncSubscription(sub);
    }
  }

  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  if (admins?.length) await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'dispute',
    title: `Chargeback: a customer disputed ${what} ($${((dispute.amount ?? 0) / 100).toFixed(2)}). Their subscriptions were ended; respond to the dispute in Stripe.`, link: '/admin' })));
}
