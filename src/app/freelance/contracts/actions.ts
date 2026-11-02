'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { HIRER_ROLES, requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AUTO_RELEASE_DAYS, releaseMilestone, vetRateFor } from '@/lib/payments';
import { SITE, notifyMember } from '@/lib/email';
import { FREELANCE_FEES } from '@/lib/fees';
import { FREELANCE_PAYMENTS_ENABLED } from '@/lib/flags';
import { askFreelancerToPayBooking, bookingCheckoutUrl, bookingFeeCents, bookingRequired, isOnSite, markHired, refundBooking } from '@/lib/booking';

const t = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? '').trim().slice(0, max);
const back = (id: string, q = '') => redirect(`/freelance/contracts/${id}${q}`);

async function loadMilestone(milestoneId: string) {
  // RLS: only the two parties (or an admin) can read it.
  const { data } = await (await createClient()).from('milestones').select('id, contract_id, title, status, amount_cents, contract:contracts(id, title, client_id, freelancer_id, status)').eq('id', milestoneId).maybeSingle();
  return data as unknown as { id: string; contract_id: string; title: string; status: string; amount_cents: number; contract: { id: string; title: string; client_id: string; freelancer_id: string; status: string } } | null;
}

/** Send the client to pay the booking fee (or back to the contract with an error if checkout can't open). */
async function goPayBooking(contractId: string, clientId: string, email: string | undefined) {
  let url: string | null = null;
  try { url = await bookingCheckoutUrl(contractId, clientId, email); } catch (err) { console.error('booking checkout failed:', err); }
  redirect(url ?? `/freelance/contracts/${contractId}?error=booking`);
}

/**
 * Client hires a freelancer from a proposal. The veteran's fee rate is locked in at this moment. When a booking fee
 * applies (see lib/booking.ts), the job is booked, and the freelancer told, only once the client pays it.
 */
export async function hireFreelancer(proposalId: string) {
  const { user } = await requireRole(HIRER_ROLES, '/freelance');
  const { data: p } = await (await createClient()).from('proposals').select('id, bid_amount, status, freelancer_id, covers_booking_fee, project:freelance_projects(id, title, client_id, status, work_location, budget_min)').eq('id', proposalId).maybeSingle();
  const proposal = p as unknown as { id: string; bid_amount: number; status: string; freelancer_id: string; covers_booking_fee: boolean; project: { id: string; title: string; client_id: string; status: string; work_location: string | null; budget_min: number | null } } | null;
  if (!proposal || proposal.project.client_id !== user.id) redirect('/freelance');
  const admin = createAdminClient();
  // A booking already started for this proposal: finish paying for it instead of starting another.
  const { data: existing } = await admin.from('contracts').select('id, status, booking_status, booking_fee_payer').eq('proposal_id', proposal.id).maybeSingle();
  if (existing) {
    if (existing.status === 'active' && existing.booking_status === 'awaiting_payment' && existing.booking_fee_payer === 'client') await goPayBooking(existing.id as string, user.id, user.email);
    redirect(`/freelance/contracts/${existing.id}`);
  }
  if (!['submitted', 'shortlisted'].includes(proposal.status) || proposal.project.status !== 'open') redirect(`/freelance/projects/${proposal.project.id}`);
  const price = proposal.bid_amount * 100;
  if (price < 2500) redirect(`/freelance/projects/${proposal.project.id}?error=minimum`);
  const [{ data: fp }, { data: vet }] = await Promise.all([
    admin.from('freelancer_profiles').select('payouts_enabled').eq('profile_id', proposal.freelancer_id).maybeSingle(),
    admin.from('veteran_profiles').select('plan').eq('profile_id', proposal.freelancer_id).maybeSingle(),
  ]);
  // Payout setup only matters once LanceNest handles milestone payments.
  if (FREELANCE_PAYMENTS_ENABLED && !fp?.payouts_enabled) redirect(`/freelance/projects/${proposal.project.id}?error=payouts`);
  const onSite = isOnSite(proposal.project.work_location);
  // The fee follows the real size of the job: a bid far under the client's own budget doesn't lower it.
  const fee = bookingRequired(onSite) ? bookingFeeCents(Math.max(price, (proposal.project.budget_min ?? 0) * 100)) : 0;
  const { data: contract, error } = await admin.from('contracts').insert({
    project_id: proposal.project.id, proposal_id: proposal.id, client_id: user.id, freelancer_id: proposal.freelancer_id,
    title: proposal.project.title, veteran_fee_rate: vetRateFor((vet?.plan as string) ?? 'free'),
    on_site: onSite, booking_status: fee ? 'awaiting_payment' : 'not_required', booking_fee_cents: fee || null,
    booking_fee_payer: fee && proposal.covers_booking_fee ? 'freelancer' : 'client',
  }).select('id, title, client_id, freelancer_id, project_id, proposal_id, service_id').single();
  if (error || !contract) redirect(`/freelance/projects/${proposal.project.id}?error=save`);
  await admin.from('milestones').insert({ contract_id: contract.id, title: 'Full project', amount_cents: price });
  // The freelancer offered to cover the booking fee: they pay it to confirm, and the client waits (pays nothing).
  if (fee && proposal.covers_booking_fee) {
    await askFreelancerToPayBooking({ id: contract.id as string, title: contract.title as string, freelancer_id: contract.freelancer_id as string, booking_fee_cents: fee });
    redirect(`/freelance/contracts/${contract.id}?requested=1`);
  }
  if (fee) await goPayBooking(contract.id as string, user.id, user.email);
  await markHired(contract as Parameters<typeof markHired>[0]);
  redirect(`/freelance/contracts/${contract.id}?hired=1`);
}

/** While payments are off, the client confirms the booked job is done, so both sides can leave reviews. */
export async function markContractComplete(contractId: string) {
  const { user } = await requireRole(HIRER_ROLES, `/freelance/contracts/${contractId}`);
  if (FREELANCE_PAYMENTS_ENABLED) back(contractId);
  const admin = createAdminClient();
  const { data: k } = await admin.from('contracts').update({ status: 'completed' })
    .eq('id', contractId).eq('client_id', user.id).eq('status', 'active').eq('booking_status', 'paid')
    .select('id, title, freelancer_id').maybeSingle();
  if (k) {
    await admin.from('milestones').update({ status: 'cancelled' }).eq('contract_id', contractId).eq('status', 'pending');
    await notifyMember(k.freelancer_id as string, { type: 'contract', link: `/freelance/contracts/${contractId}`, title: `“${k.title}” was marked complete. Leave a review for your client.` });
  }
  revalidatePath(`/freelance/contracts/${contractId}`);
  back(contractId, k ? '?completed=1' : '');
}

/** Client pays the booking fee for a request they already started. */
export async function payBooking(contractId: string) {
  const { user } = await requireRole(HIRER_ROLES, `/freelance/contracts/${contractId}`);
  await goPayBooking(contractId, user.id, user.email);
}

/** The freelancer covers the booking fee on this job: they pay it to confirm the booking. */
export async function payBookingAsFreelancer(contractId: string) {
  const { user } = await requireRole(['veteran'], `/freelance/contracts/${contractId}`);
  let url: string | null = null;
  try { url = await bookingCheckoutUrl(contractId, user.id, user.email); } catch (err) { console.error('booking checkout failed:', err); }
  redirect(url ?? `/freelance/contracts/${contractId}?error=booking`);
}

/** Client withdraws a request they haven't paid the booking fee for. Nothing was charged. */
export async function cancelBooking(contractId: string) {
  const { user } = await requireRole(HIRER_ROLES, `/freelance/contracts/${contractId}`);
  const admin = createAdminClient();
  const { data: k } = await admin.from('contracts').update({ status: 'cancelled' })
    .eq('id', contractId).eq('client_id', user.id).eq('status', 'active').eq('booking_status', 'awaiting_payment').select('id').maybeSingle();
  if (k) await admin.from('milestones').update({ status: 'cancelled' }).eq('contract_id', contractId).eq('status', 'pending');
  revalidatePath(`/freelance/contracts/${contractId}`);
  redirect(`/freelance/contracts/${contractId}`);
}

export async function addMilestone(contractId: string, formData: FormData) {
  const { user } = await requireRole(HIRER_ROLES, '/freelance');
  const { data: c } = await (await createClient()).from('contracts').select('id, client_id, status, booking_status').eq('id', contractId).maybeSingle();
  if (!c || c.client_id !== user.id || c.status !== 'active' || c.booking_status === 'awaiting_payment') back(contractId);
  const amount = Math.round(Number(t(formData, 'amount', 9).replace(/[$,\s]/g, '')) * 100);
  const title = t(formData, 'title', 140);
  if (!Number.isFinite(amount) || amount < 2500 || title.length < 2) back(contractId, '?error=milestone');
  const { error } = await createAdminClient().from('milestones').insert({ contract_id: contractId, title, amount_cents: amount });
  if (error?.code === 'P0022') back(contractId, '?error=explicit');
  revalidatePath(`/freelance/contracts/${contractId}`);
  back(contractId);
}

export async function cancelMilestone(milestoneId: string) {
  const { user } = await requireRole(HIRER_ROLES, '/freelance');
  const m = await loadMilestone(milestoneId);
  if (!m || m.contract.client_id !== user.id || m.status !== 'pending') redirect('/freelance');
  await createAdminClient().from('milestones').update({ status: 'cancelled' }).eq('id', milestoneId).eq('status', 'pending');
  const { completeIfDone } = await import('@/lib/payments'); await completeIfDone(m.contract_id);
  back(m.contract_id);
}

export async function submitMilestone(milestoneId: string, formData: FormData) {
  const { user } = await requireRole(['veteran'], '/freelance');
  const m = await loadMilestone(milestoneId);
  if (!m || m.contract.freelancer_id !== user.id || m.status !== 'funded') redirect('/freelance');
  if (t(formData, 'note', 2000).length < 10) redirect(`/freelance/contracts/${m.contract_id}?error=delivery`);
  const { error } = await createAdminClient().from('milestones').update({
    status: 'submitted', submitted_at: new Date().toISOString(), submission_note: t(formData, 'note', 2000) || null, change_request: null,
    auto_release_at: new Date(Date.now() + AUTO_RELEASE_DAYS * 86400000).toISOString(),
  }).eq('id', milestoneId).eq('status', 'funded');
  if (error?.code === 'P0022') back(m.contract_id, '?error=explicit');
  await notifyMember(m.contract.client_id, { type: 'milestone', link: `/freelance/contracts/${m.contract_id}`, title: `Work submitted for “${m.title}”. Review it — it releases automatically in ${AUTO_RELEASE_DAYS} days.`,
    email: { subject: `Work submitted: ${m.title}`, preheader: `Please review within ${AUTO_RELEASE_DAYS} days.`, tone: 'notice', badge: 'Review needed',
      heading: 'Work is ready for your review.', paragraphs: [`Your freelancer submitted “${m.title}” on ${m.contract.title}.`, `Approve it to release payment, or request changes. If there’s no response in ${AUTO_RELEASE_DAYS} days, payment releases automatically.`],
      cta: { label: 'Review the work', url: `${SITE}/freelance/contracts/${m.contract_id}` } } });
  back(m.contract_id);
}

export async function requestChanges(milestoneId: string, formData: FormData) {
  const { user } = await requireRole(HIRER_ROLES, '/freelance');
  const m = await loadMilestone(milestoneId);
  if (!m || m.contract.client_id !== user.id || m.status !== 'submitted') redirect('/freelance');
  if (t(formData, 'changes', 2000).length < 10) redirect(`/freelance/contracts/${m.contract_id}?error=changes`);
  const { error } = await createAdminClient().from('milestones').update({ status: 'funded', auto_release_at: null, change_request: t(formData, 'changes', 2000) || 'Changes requested.' }).eq('id', milestoneId).eq('status', 'submitted');
  if (error?.code === 'P0022') back(m.contract_id, '?error=explicit');
  await notifyMember(m.contract.freelancer_id, { type: 'milestone', link: `/freelance/contracts/${m.contract_id}`, title: `Changes requested on “${m.title}”.` });
  back(m.contract_id);
}

export async function approveMilestone(milestoneId: string) {
  const { user } = await requireRole(HIRER_ROLES, '/freelance');
  const m = await loadMilestone(milestoneId);
  if (!m || m.contract.client_id !== user.id || !['funded', 'submitted'].includes(m.status)) redirect('/freelance');
  const r = await releaseMilestone(milestoneId, 'approved');
  revalidatePath(`/freelance/contracts/${m.contract_id}`);
  back(m.contract_id, r.ok ? '?released=1' : `?error=${r.error}`);
}

export async function openDispute(milestoneId: string, formData: FormData) {
  const { user } = await requireRole([...HIRER_ROLES, 'veteran'], '/freelance');
  const m = await loadMilestone(milestoneId);
  if (!m || ![m.contract.client_id, m.contract.freelancer_id].includes(user.id) || !['funded', 'submitted'].includes(m.status)) redirect('/freelance');
  const reason = t(formData, 'reason', 2000);
  if (reason.length < 10) back(m.contract_id, '?error=dispute');
  const admin = createAdminClient();
  const { error } = await admin.from('milestones').update({ status: 'disputed', auto_release_at: null, dispute_reason: reason }).eq('id', milestoneId).in('status', ['funded', 'submitted']);
  if (error?.code === 'P0022') back(m.contract_id, '?error=explicit');
  await admin.from('contracts').update({ status: 'disputed' }).eq('id', m.contract_id);
  const other = user.id === m.contract.client_id ? m.contract.freelancer_id : m.contract.client_id;
  await notifyMember(other, { type: 'milestone', link: `/freelance/contracts/${m.contract_id}`, title: `A dispute was opened on “${m.title}”. LanceNest will review it — the payment stays protected meanwhile.` });
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  if (admins?.length) await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'dispute', title: `Payment dispute opened: “${m.title}” ($${(m.amount_cents / 100).toLocaleString()})`, link: '/admin/disputes' })));
  back(m.contract_id, '?disputed=1');
}

export async function leaveReview(contractId: string, revieweeId: string, formData: FormData) {
  const { user } = await requireRole([...HIRER_ROLES, 'veteran'], '/freelance');
  const rating = Math.round(Number(formData.get('rating')));
  if (!(rating >= 1 && rating <= 5)) back(contractId, '?error=review');
  // Row-level security enforces: completed contract, you’re a party, and you’re reviewing the other party.
  const { data: saved } = await (await createClient()).from('reviews').insert({ contract_id: contractId, reviewer_id: user.id, reviewee_id: revieweeId, rating, body: t(formData, 'body', 2000) || null }).select('held').maybeSingle();
  revalidatePath(`/freelance/contracts/${contractId}`);
  // New client accounts' reviews are checked by LanceNest before they show (see migration 0089).
  back(contractId, saved?.held ? '?reviewed=held' : '?reviewed=1');
}

/** The freelancer can decline a request before any money is funded. */
export async function declineContract(contractId: string) {
  const { user } = await requireRole(['veteran', 'admin'], '/freelance');
  const admin = createAdminClient();
  const { data: c } = await admin.from('contracts').select('id, title, client_id, freelancer_id, status').eq('id', contractId).maybeSingle();
  if (!c || c.freelancer_id !== user.id || c.status !== 'active') redirect('/freelance');
  const { data: ms } = await admin.from('milestones').select('status').eq('contract_id', contractId);
  if ((ms ?? []).some((m) => m.status !== 'pending' && m.status !== 'cancelled')) redirect(`/freelance/contracts/${contractId}?error=state`);
  let refund: Awaited<ReturnType<typeof refundBooking>> = 'none';
  try { refund = await refundBooking(contractId); } catch (err) { console.error('booking refund failed:', err); refund = 'review'; }
  await admin.from('milestones').update({ status: 'cancelled' }).eq('contract_id', contractId).eq('status', 'pending');
  await admin.from('contracts').update({ status: 'cancelled' }).eq('id', contractId);
  // Let them hire someone else from the same project.
  const { data: k } = await admin.from('contracts').select('proposal_id, project_id').eq('id', contractId).maybeSingle();
  if (k?.proposal_id) await admin.from('proposals').update({ status: 'declined' }).eq('id', k.proposal_id);
  if (k?.project_id) await admin.from('freelance_projects').update({ status: 'open' }).eq('id', k.project_id).eq('status', 'in_progress');
  await notifyMember(c.client_id as string, { type: 'contract', link: `/freelance/contracts/${contractId}`, title: `Your request for “${c.title}” was declined. ${refund === 'refunded' ? 'Your booking fee is being refunded.' : refund === 'review' ? 'LanceNest will review a refund of your booking fee and email you.' : 'Nothing was charged.'}` });
  redirect(`/freelance/contracts/${contractId}`);
}

/**
 * Conversion, matching Upwork's (lib/fees.ts): within 24 months of meeting on LanceNest, a client can move the
 * relationship off LanceNest, as a full-time hire or by working together outside LanceNest, for 13.5% of the
 * freelancer's expected earnings from them over the next 12 months, less booking fees paid on work with this freelancer
 * in the last 12 months, at least $1,000. No fee after 24 months. LanceNest confirms and invoices it.
 */
export async function requestConversion(contractId: string, formData: FormData) {
  const { user } = await requireRole(HIRER_ROLES, '/freelance');
  const admin = createAdminClient();
  const { data: c } = await admin.from('contracts').select('id, title, client_id, freelancer_id').eq('id', contractId).maybeSingle();
  if (!c || c.client_id !== user.id) redirect('/freelance');
  const kind = formData.get('kind') === 'off_platform' ? 'off_platform' : 'full_time';
  const estimate = Math.round(Number(String(formData.get('estimate') ?? '').replace(/[$,\s]/g, '')) * 100);
  if (!Number.isFinite(estimate) || estimate < (kind === 'full_time' ? 1000000 : 10000)) redirect(`/freelance/contracts/${contractId}?error=salary`);
  const { rate, minimumCents, waivedAfterMonths } = FREELANCE_FEES.conversionFee;
  // When the two first found each other here: their first proposal, booking or conversation.
  const [{ data: firstK }, { data: firstP }, { data: myConvs }] = await Promise.all([
    admin.from('contracts').select('created_at').eq('client_id', c.client_id).eq('freelancer_id', c.freelancer_id).order('created_at').limit(1).maybeSingle(),
    admin.from('proposals').select('created_at, project:freelance_projects!inner(client_id)').eq('freelancer_id', c.freelancer_id).eq('project.client_id', c.client_id).order('created_at').limit(1).maybeSingle(),
    admin.from('conversation_participants').select('conversation_id').eq('profile_id', c.client_id).limit(1000),
  ]);
  const ids = (myConvs ?? []).map((r) => r.conversation_id as string);
  const { data: shared } = ids.length
    ? await admin.from('conversation_participants').select('conversation:conversations(created_at)').eq('profile_id', c.freelancer_id).in('conversation_id', ids).limit(50)
    : { data: [] };
  const times = [firstK?.created_at, firstP?.created_at, ...((shared ?? []) as unknown as { conversation: { created_at: string } | null }[]).map((r) => r.conversation?.created_at)]
    .filter((x): x is string => !!x).map((x) => Date.parse(x));
  const met = times.length ? Math.min(...times) : Date.now();
  const within = Date.now() - met < waivedAfterMonths * 30.44 * 86400000;
  // Like Upwork: booking fees this client paid on work with this freelancer in the last 12 months count toward it.
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString();
  const { data: paid } = await admin.from('contracts').select('id, booking_fee_cents, booking_status, booking_fee_payer')
    .eq('client_id', c.client_id).eq('freelancer_id', c.freelancer_id).gte('created_at', yearAgo);
  const paidIds = (paid ?? []).map((k) => k.id as string);
  const { data: topups } = paidIds.length ? await admin.from('contract_invoices').select('fee_paid_cents').in('contract_id', paidIds) : { data: [] };
  const discount = (paid ?? []).filter((k) => k.booking_status === 'paid' && k.booking_fee_payer !== 'freelancer').reduce((a, k) => a + ((k.booking_fee_cents as number | null) ?? 0), 0)
    + (topups ?? []).reduce((a, i) => a + ((i.fee_paid_cents as number | null) ?? 0), 0);
  const fee = within ? Math.max(Math.round(estimate * rate) - discount, minimumCents) : 0;
  await admin.from('conversion_requests').insert({ contract_id: c.id, client_id: c.client_id, freelancer_id: c.freelancer_id, kind, estimate_cents: estimate,
    salary_cents: kind === 'full_time' ? estimate : null, discount_cents: within ? discount : 0, fee_cents: fee });
  const label = kind === 'full_time' ? 'Full-time hire' : 'Working together outside LanceNest';
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  if (admins?.length) await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'conversion', title: `${label} on “${c.title}” — ${fee ? `invoice $${(fee / 100).toLocaleString()}` : `no fee (${waivedAfterMonths}+ months since they met on LanceNest)`}.`, link: '/admin/leads' })));
  await notifyMember(c.freelancer_id as string, { type: 'contract', link: `/freelance/contracts/${c.id}`, title: kind === 'full_time'
    ? `Congratulations — your client wants to hire you full-time from “${c.title}”.`
    : `Your client asked to keep working with you outside LanceNest after “${c.title}”. LanceNest will confirm it with both of you.` });
  redirect(`/freelance/contracts/${contractId}?converted=1`);
}
