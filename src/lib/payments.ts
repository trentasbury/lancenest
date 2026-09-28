import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe';
import { FREELANCE_FEES } from '@/lib/fees';
import { SITE, notifyMember } from '@/lib/email';
import { feeBreakdown } from '@/lib/feeMath';

export { feeBreakdown };
export const AUTO_RELEASE_DAYS = 14;

type Milestone = { id: string; contract_id: string; title: string; amount_cents: number; status: string; client_fee_cents: number; stripe_payment_intent_id: string | null; stripe_charge_id: string | null };

async function contractOf(contractId: string) {
  const { data } = await createAdminClient().from('contracts').select('id, title, client_id, freelancer_id, veteran_fee_rate, status').eq('id', contractId).single();
  return data as { id: string; title: string; client_id: string; freelancer_id: string; veteran_fee_rate: number; status: string };
}

/** Called from the Stripe webhook / success page. Idempotent: only a 'pending' milestone becomes 'funded'. */
export async function fundMilestoneFromSession(sessionId: string) {
  const s = await stripe().checkout.sessions.retrieve(sessionId, { expand: ['payment_intent'] });
  if (s.metadata?.kind !== 'milestone' || s.payment_status !== 'paid') return { ok: false as const };
  const pi = s.payment_intent && typeof s.payment_intent !== 'string' ? s.payment_intent : null;
  const admin = createAdminClient();
  const { data: updated } = await admin.from('milestones').update({
    status: 'funded', funded_at: new Date().toISOString(), stripe_payment_intent_id: pi?.id ?? null,
    stripe_charge_id: pi && typeof pi.latest_charge === 'string' ? pi.latest_charge : (pi?.latest_charge as { id?: string } | null)?.id ?? null,
  }).eq('id', s.metadata.milestone_id).eq('status', 'pending').select('id, contract_id, title, amount_cents').maybeSingle();
  if (updated) {
    const c = await contractOf(updated.contract_id as string);
    await notifyMember(c.freelancer_id, { type: 'milestone', link: `/freelance/contracts/${c.id}`, title: `Funded: “${updated.title}” ($${((updated.amount_cents as number) / 100).toLocaleString()}) — you can start work.`,
      email: { subject: `Milestone funded: ${updated.title}`, preheader: 'The payment is protected — you can start work.', tone: 'success', badge: 'Protected Payment',
        heading: 'Your milestone is funded.', paragraphs: [`The client funded “${updated.title}” on ${c.title}. The money is held by LanceNest and released to you when the client approves your work — or automatically ${AUTO_RELEASE_DAYS} days after you submit.`],
        cta: { label: 'Open the contract', url: `${SITE}/freelance/contracts/${c.id}` } } });
  }
  return { ok: true as const, kind: 'milestone' };
}

/** Pays the veteran their share (amount minus their locked fee rate). Used by client approval, auto-release, and admin dispute resolution. */
export async function releaseMilestone(milestoneId: string, reason: 'approved' | 'auto' | 'dispute') {
  const admin = createAdminClient();
  const { data: m } = await admin.from('milestones').select('*').eq('id', milestoneId).maybeSingle() as { data: Milestone | null };
  if (!m || !['funded', 'submitted', 'disputed'].includes(m.status)) return { ok: false as const, error: 'state' };
  const c = await contractOf(m.contract_id);
  const { data: fp } = await admin.from('freelancer_profiles').select('stripe_account_id, payouts_enabled').eq('profile_id', c.freelancer_id).maybeSingle();
  if (!fp?.stripe_account_id || !fp.payouts_enabled) return { ok: false as const, error: 'payouts' };
  // Lock the row first so a double click or a racing cron can't pay twice.
  const { data: locked } = await admin.from('milestones').update({ status: 'released', released_at: new Date().toISOString() }).eq('id', m.id).eq('status', m.status).select('id').maybeSingle();
  if (!locked) return { ok: false as const, error: 'state' };
  const payout = Math.round(m.amount_cents * (1 - Number(c.veteran_fee_rate)));
  try {
    const transfer = await stripe().transfers.create({
      amount: payout, currency: 'usd', destination: fp.stripe_account_id as string, transfer_group: c.id,
      ...(m.stripe_charge_id ? { source_transaction: m.stripe_charge_id } : {}),
      metadata: { milestone_id: m.id, contract_id: c.id, reason },
    }, { idempotencyKey: `release-${m.id}` });
    await admin.from('milestones').update({ stripe_transfer_id: transfer.id }).eq('id', m.id);
  } catch (err) {
    console.error('transfer failed:', err);
    await admin.from('milestones').update({ status: m.status, released_at: null }).eq('id', m.id);   // roll back so it can be retried
    return { ok: false as const, error: 'transfer' };
  }
  await notifyMember(c.freelancer_id, { type: 'milestone', link: `/freelance/contracts/${c.id}`, title: `Paid: $${(payout / 100).toLocaleString()} for “${m.title}” is on its way to your bank.`,
    email: { subject: `You’ve been paid for ${m.title}`, preheader: 'Your payment is on its way to your bank.', tone: 'success', badge: 'Payment released',
      heading: `$${(payout / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} is on its way.`,
      paragraphs: [`“${m.title}” on ${c.title} was ${reason === 'auto' ? `automatically released after ${AUTO_RELEASE_DAYS} days` : reason === 'dispute' ? 'released after review' : 'approved by the client'}. Stripe will deposit it to your bank on your normal payout schedule.`],
      cta: { label: 'View the contract', url: `${SITE}/freelance/contracts/${c.id}` } } });
  await completeIfDone(c.id);
  return { ok: true as const, payout };
}

/** Refunds the client the milestone amount plus their percentage fee (the flat contract fee covers processing and isn't refunded). */
export async function refundMilestone(milestoneId: string) {
  const admin = createAdminClient();
  const { data: m } = await admin.from('milestones').select('*').eq('id', milestoneId).maybeSingle() as { data: Milestone | null };
  if (!m || !['funded', 'submitted', 'disputed'].includes(m.status) || !m.stripe_payment_intent_id) return { ok: false as const };
  const { data: locked } = await admin.from('milestones').update({ status: 'refunded' }).eq('id', m.id).eq('status', m.status).select('id').maybeSingle();
  if (!locked) return { ok: false as const };
  try {
    await stripe().refunds.create({ payment_intent: m.stripe_payment_intent_id, amount: m.amount_cents + m.client_fee_cents }, { idempotencyKey: `refund-${m.id}` });
  } catch (err) {
    console.error('refund failed:', err);
    await admin.from('milestones').update({ status: m.status }).eq('id', m.id);
    return { ok: false as const };
  }
  const c = await contractOf(m.contract_id);
  await notifyMember(c.client_id, { type: 'milestone', link: `/freelance/contracts/${c.id}`, title: `Refunded: “${m.title}” on ${c.title}.` });
  await notifyMember(c.freelancer_id, { type: 'milestone', link: `/freelance/contracts/${c.id}`, title: `“${m.title}” on ${c.title} was refunded to the client after review.` });
  await completeIfDone(c.id);
  return { ok: true as const };
}

export async function completeIfDone(contractId: string) {
  const admin = createAdminClient();
  const { data: ms } = await admin.from('milestones').select('status').eq('contract_id', contractId);
  const open = (ms ?? []).some((x) => ['pending', 'funded', 'submitted', 'disputed'].includes(x.status as string));
  const anyPaid = (ms ?? []).some((x) => x.status === 'released');
  if (!open && (ms ?? []).length) await admin.from('contracts').update({ status: anyPaid ? 'completed' : 'cancelled' }).eq('id', contractId).in('status', ['active', 'disputed']);
}

export function vetRateFor(plan: string) {
  return FREELANCE_FEES.veteranRate[plan] ?? FREELANCE_FEES.veteranRate.free;
}
