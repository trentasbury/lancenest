import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe';
import { SITE, notifyMember } from '@/lib/email';
import { getMyCompany } from '@/lib/employer';
import { FREELANCE_PAYMENTS_ENABLED } from '@/lib/flags';
import { bookingFeeCents } from '@/lib/feeMath';

export { bookingFeeCents };

/**
 * Booking fees. The client pays LanceNest a small booking fee (tiers in lib/fees.ts) when they hire, before the job is
 * booked and before contact details can be shared. It's LanceNest's own fee, so it can't be skipped by paying the
 * freelancer in cash. While Protected Payments are off it applies to every hire; once they're on, remote work is paid
 * through LanceNest (the payment fees apply) and on-site work keeps the booking fee, which then replaces the
 * contract-start fee so nobody pays twice.
 */
export function bookingRequired(onSite: boolean) {
  return !FREELANCE_PAYMENTS_ENABLED || onSite;
}

/** A project's location counts as on-site unless it says remote. */
export function isOnSite(location: string | null | undefined) {
  const l = (location ?? '').trim().toLowerCase();
  return !!l && !/^(remote|anywhere|virtual|online)\b/.test(l);
}

export const usd = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Stripe Checkout for an unpaid booking. Only the contract's client can open it. Returns the checkout URL, or null. */
export async function bookingCheckoutUrl(contractId: string, clientId: string, email: string | undefined) {
  const admin = createAdminClient();
  const { data: k } = await admin.from('contracts').select('id, title, client_id, status, booking_status, booking_fee_cents').eq('id', contractId).maybeSingle();
  if (!k || k.client_id !== clientId || k.status !== 'active' || k.booking_status !== 'awaiting_payment' || !k.booking_fee_cents) return null;
  const company = await getMyCompany(clientId);
  const meta = { kind: 'booking', contract_id: k.id as string, ...(company ? { company_id: company.id } : {}) };
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: k.booking_fee_cents as number, product_data: {
      name: `LanceNest booking fee: ${k.title as string}`.slice(0, 250),
      description: 'Confirms the booking with your verified freelancer. Refunded if the freelancer declines within 48 hours.',
    } } }],
    metadata: meta, payment_intent_data: { metadata: meta },
    ...(company?.stripe_customer_id ? { customer: company.stripe_customer_id } : email ? { customer_email: email } : {}),
    allow_promotion_codes: true,
    success_url: `${SITE}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE}/freelance/contracts/${k.id}`,
  });
  return session.url;
}

type Booked = { id: string; title: string; client_id: string; freelancer_id: string; project_id: string | null; proposal_id: string | null; service_id: string | null };

/** Marks the job hired: proposal accepted, project in progress, freelancer told. Used for paid bookings and fee-free hires. */
export async function markHired(k: Booked) {
  const admin = createAdminClient();
  if (k.proposal_id) await admin.from('proposals').update({ status: 'accepted' }).eq('id', k.proposal_id);
  if (k.project_id) await admin.from('freelance_projects').update({ status: 'in_progress' }).eq('id', k.project_id);
  const next = FREELANCE_PAYMENTS_ENABLED
    ? 'Wait for the milestone to show “Funded” before starting work. That means the payment is protected and held for you.'
    : 'You can now share contact details in messages and agree on the schedule and payment directly with the client.';
  await notifyMember(k.freelancer_id, { type: 'contract', link: `/freelance/contracts/${k.id}`, title: `You’re hired for “${k.title}”.`,
    email: { subject: `You’re hired: ${k.title}`, preheader: 'A verified client booked you on LanceNest.', tone: 'success', badge: 'Hired',
      heading: 'Congratulations, you’re hired.', paragraphs: [`A client booked you for “${k.title}”.`, next, 'Not a fit? Decline from the contract page within 48 hours.'],
      cta: { label: 'Open the contract', url: `${SITE}/freelance/contracts/${k.id}` } } });
}

/** Called from the Stripe webhook and the success page. Runs once per booking (only an unpaid booking can become paid). */
export async function confirmBookingFromSession(sessionId: string, contractId: string, amountPaid: number) {
  const admin = createAdminClient();
  const { data: k } = await admin.from('contracts')
    .update({ booking_status: 'paid', booking_paid_at: new Date().toISOString(), booking_checkout_session_id: sessionId, booking_fee_cents: amountPaid })
    .eq('id', contractId).eq('booking_status', 'awaiting_payment')
    .select('id, title, client_id, freelancer_id, project_id, proposal_id, service_id').maybeSingle();
  if (k) await markHired(k as Booked);
  return { ok: true as const, kind: 'booking', contractId };
}

/**
 * The freelancer declined a paid booking. The fee is refunded automatically only if they declined within 48 hours and the
 * two haven't messaged since the booking; otherwise LanceNest reviews it, so a job declined on paper but done for cash
 * can't get its fee back. Safe to call twice.
 */
export async function refundBooking(contractId: string): Promise<'refunded' | 'review' | 'none'> {
  const admin = createAdminClient();
  const { data: k } = await admin.from('contracts').select('title, client_id, freelancer_id, booking_status, booking_paid_at, booking_checkout_session_id, booking_fee_cents').eq('id', contractId).maybeSingle();
  if (k?.booking_status !== 'paid' || !k.booking_checkout_session_id) return 'none';
  const paidAt = k.booking_paid_at as string;
  const { data: mine } = await admin.from('conversation_participants').select('conversation_id').eq('profile_id', k.client_id);
  const ids = (mine ?? []).map((r) => r.conversation_id as string);
  const { data: shared } = ids.length ? await admin.from('conversation_participants').select('conversation_id').eq('profile_id', k.freelancer_id).in('conversation_id', ids) : { data: [] };
  const sharedIds = (shared ?? []).map((r) => r.conversation_id as string);
  const { count } = sharedIds.length ? await admin.from('messages').select('id', { count: 'exact', head: true }).in('conversation_id', sharedIds).gt('created_at', paidAt) : { count: 0 };
  if ((count ?? 0) > 0 || Date.now() - Date.parse(paidAt) > 48 * 3600000) {
    const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
    if (admins?.length) await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'dispute', title: `Booking fee refund to review: “${k.title}” (${usd(k.booking_fee_cents as number)}) was declined after the parties talked or after 48 hours.`, link: `/freelance/contracts/${contractId}` })));
    return 'review';
  }
  const s = await stripe().checkout.sessions.retrieve(k.booking_checkout_session_id as string);
  const pi = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id;
  if (!pi) return 'none';
  await stripe().refunds.create({ payment_intent: pi, metadata: { contract_id: contractId, reason: 'freelancer_declined' } }, { idempotencyKey: `booking-refund-${contractId}` });
  return 'refunded';
}
