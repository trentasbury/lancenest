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

/**
 * Stripe Checkout for an unpaid booking. Only whoever pays the fee can open it: the client, or the freelancer when they
 * chose to cover the booking fee. Returns the checkout URL, or null.
 */
export async function bookingCheckoutUrl(contractId: string, payerId: string, email: string | undefined) {
  const admin = createAdminClient();
  const { data: k } = await admin.from('contracts').select('id, title, client_id, freelancer_id, status, booking_status, booking_fee_cents, booking_fee_payer').eq('id', contractId).maybeSingle();
  if (!k || k.status !== 'active' || k.booking_status !== 'awaiting_payment' || !k.booking_fee_cents) return null;
  const byFreelancer = k.booking_fee_payer === 'freelancer';
  if ((byFreelancer ? k.freelancer_id : k.client_id) !== payerId) return null;
  const company = byFreelancer ? null : await getMyCompany(payerId);
  const meta = { kind: 'booking', contract_id: k.id as string, payer: byFreelancer ? 'freelancer' : 'client', ...(company ? { company_id: company.id } : {}) };
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: k.booking_fee_cents as number, product_data: {
      name: `LanceNest booking fee: ${k.title as string}`.slice(0, 250),
      description: byFreelancer
        ? 'You chose to cover the booking fee, so your client pays none. Confirms the booking and opens contact details. Refunded if you decline within 48 hours, before you and the client message.'
        : 'Confirms the booking with your verified freelancer. Refunded if the freelancer declines within 48 hours.',
    } } }],
    metadata: meta, payment_intent_data: { metadata: meta },
    ...(company?.stripe_customer_id ? { customer: company.stripe_customer_id } : email ? { customer_email: email } : {}),
    // Booking fees never take promo codes (a code made for plans must not zero out a booking fee).
    allow_promotion_codes: false,
    success_url: `${SITE}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE}/freelance/contracts/${k.id}`,
  });
  return session.url;
}

/**
 * The booking fee follows what's actually invoiced (approved November 1, 2026): 5% of the larger of the booked price
 * and everything invoiced on the job, still at least $4.99 and at most $499 in all. Returns what's still owed for a
 * new invoice of this amount (0 if the fee already paid covers it). Void invoices don't count.
 */
export async function invoiceFeeDue(contractId: string, newAmountCents: number) {
  const admin = createAdminClient();
  const [{ data: k }, { data: invs }] = await Promise.all([
    admin.from('contracts').select('booking_fee_cents').eq('id', contractId).maybeSingle(),
    admin.from('contract_invoices').select('amount_cents, status, fee_paid_cents').eq('contract_id', contractId),
  ]);
  const live = (invs ?? []).filter((i) => i.status !== 'void');
  const invoiced = live.reduce((a, i) => a + (i.amount_cents as number), 0) + newAmountCents;
  const paid = ((k?.booking_fee_cents as number | null) ?? 0) + (invs ?? []).reduce((a, i) => a + ((i.fee_paid_cents as number | null) ?? 0), 0);
  return Math.max(0, bookingFeeCents(invoiced) - paid);
}

/** Stripe Checkout for the booking-fee top-up on a held invoice. Only whoever pays this job's booking fee can open it. */
export async function invoiceFeeCheckoutUrl(contractId: string, invoiceId: string, payerId: string, email: string | undefined) {
  const admin = createAdminClient();
  const [{ data: k }, { data: inv }] = await Promise.all([
    admin.from('contracts').select('id, title, client_id, freelancer_id, booking_fee_payer').eq('id', contractId).maybeSingle(),
    admin.from('contract_invoices').select('id, number, amount_cents, status, held, fee_due_cents').eq('id', invoiceId).eq('contract_id', contractId).maybeSingle(),
  ]);
  if (!k || !inv || !inv.held || inv.status === 'void' || !((inv.fee_due_cents as number) > 0)) return null;
  const byFreelancer = k.booking_fee_payer === 'freelancer';
  if ((byFreelancer ? k.freelancer_id : k.client_id) !== payerId) return null;
  const company = byFreelancer ? null : await getMyCompany(payerId);
  const meta = { kind: 'booking_topup', contract_id: k.id as string, invoice_id: inv.id as string, payer: byFreelancer ? 'freelancer' : 'client', ...(company ? { company_id: company.id } : {}) };
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: inv.fee_due_cents as number, product_data: {
      name: `LanceNest booking fee update: ${k.title as string}`.slice(0, 250),
      description: `Invoice ${inv.number as string} (${usd(inv.amount_cents as number)}) brings this job past the amount its booking fee covered. The booking fee is 5% of the job, at most $499 in all. The invoice is sent as soon as this is paid.`,
    } } }],
    metadata: meta, payment_intent_data: { metadata: meta },
    ...(company?.stripe_customer_id ? { customer: company.stripe_customer_id } : email ? { customer_email: email } : {}),
    allow_promotion_codes: false,
    success_url: `${SITE}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE}/freelance/contracts/${k.id}#invoices`,
  });
  return session.url;
}

/** The top-up was paid: send the invoice. Called from the Stripe webhook and the success page; runs once per invoice. */
export async function confirmInvoiceFeeFromSession(sessionId: string, invoiceId: string, amountPaid: number) {
  const admin = createAdminClient();
  const { data: inv } = await admin.from('contract_invoices').select('id, contract_id, number, amount_cents, held, fee_due_cents, client_id, freelancer_id').eq('id', invoiceId).maybeSingle();
  if (!inv) return { ok: false as const };
  if (inv.held && amountPaid < (inv.fee_due_cents as number)) {
    const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
    if (admins?.length) await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'dispute', title: `A booking fee update for invoice ${inv.number} was paid short (${usd(amountPaid)} of ${usd(inv.fee_due_cents as number)}). The invoice wasn’t sent.`, link: `/freelance/contracts/${inv.contract_id}` })));
    return { ok: false as const };
  }
  const { data: released } = await admin.from('contract_invoices')
    .update({ held: false, fee_paid_cents: amountPaid, fee_paid_at: new Date().toISOString(), fee_checkout_session_id: sessionId })
    .eq('id', invoiceId).eq('held', true).select('id').maybeSingle();
  if (released) {
    const { data: k } = await admin.from('contracts').select('title, booking_fee_payer').eq('id', inv.contract_id).maybeSingle();
    await notifyMember(inv.client_id as string, { type: 'invoice', link: `/freelance/contracts/${inv.contract_id}#invoices`, title: `New invoice ${inv.number} for “${k?.title ?? 'your job'}”: ${usd(inv.amount_cents as number)}.` });
    if (k?.booking_fee_payer !== 'freelancer') {
      await notifyMember(inv.freelancer_id as string, { type: 'invoice', link: `/freelance/contracts/${inv.contract_id}#invoices`, title: `Your client paid the booking fee update, so invoice ${inv.number} was sent.` });
    }
  }
  return { ok: true as const, kind: 'booking_topup', contractId: inv.contract_id as string };
}

/** The freelancer covers the booking fee: tell them a client booked them and the fee is theirs to pay to confirm it. */
export async function askFreelancerToPayBooking(k: { id: string; title: string; freelancer_id: string; booking_fee_cents: number }) {
  await notifyMember(k.freelancer_id, { type: 'contract', link: `/freelance/contracts/${k.id}`, title: `A client wants to book you for “${k.title}”. Pay the ${usd(k.booking_fee_cents)} booking fee to confirm.`,
    email: { subject: `Confirm your booking: ${k.title}`, preheader: 'You chose to cover the booking fee on this job.', tone: 'notice', badge: 'Booking request',
      heading: 'A client wants to book you.',
      paragraphs: [`A client asked to book you for “${k.title}”. You chose to cover the booking fee, so the client pays none.`,
        `Pay the ${usd(k.booking_fee_cents)} booking fee to confirm the job. Contact details open as soon as it’s paid.`],
      cta: { label: 'Confirm the booking', url: `${SITE}/freelance/contracts/${k.id}` } } });
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
  // Only the full fee confirms a booking. Anything less (it shouldn't happen) goes to an admin instead.
  const { data: due } = await admin.from('contracts').select('title, booking_fee_cents, booking_status').eq('id', contractId).maybeSingle();
  if (due?.booking_status === 'awaiting_payment' && amountPaid < ((due.booking_fee_cents as number | null) ?? 0)) {
    const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
    if (admins?.length) await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'dispute', title: `A booking fee for “${due.title}” was paid short (${usd(amountPaid)} of ${usd(due.booking_fee_cents as number)}). The booking wasn’t confirmed.`, link: `/freelance/contracts/${contractId}` })));
    return { ok: false as const };
  }
  const { data: k } = await admin.from('contracts')
    .update({ booking_status: 'paid', booking_paid_at: new Date().toISOString(), booking_checkout_session_id: sessionId, booking_fee_cents: amountPaid })
    .eq('id', contractId).eq('booking_status', 'awaiting_payment')
    .select('id, title, client_id, freelancer_id, project_id, proposal_id, service_id, booking_fee_payer').maybeSingle();
  if (k) {
    await markHired(k as Booked);
    // The freelancer paid the fee, so the client hasn't heard yet: tell them the job is booked.
    if (k.booking_fee_payer === 'freelancer') {
      await notifyMember(k.client_id as string, { type: 'contract', link: `/freelance/contracts/${k.id}`, title: `“${k.title}” is booked. Your freelancer confirmed it, and contact details are open.`,
        email: { subject: `Booked: ${k.title}`, preheader: 'Your verified freelancer confirmed the job.', tone: 'success', badge: 'Booked',
          heading: 'Your job is booked.', paragraphs: [`Your freelancer confirmed “${k.title}” and covered the booking fee. You can now share contact details in messages and agree on the schedule.`],
          cta: { label: 'Open the contract', url: `${SITE}/freelance/contracts/${k.id}` } } });
    }
  }
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
