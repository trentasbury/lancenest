'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AUTO_RELEASE_DAYS, releaseMilestone, vetRateFor } from '@/lib/payments';
import { SITE, notifyMember } from '@/lib/email';

const t = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? '').trim().slice(0, max);
const back = (id: string, q = '') => redirect(`/freelance/contracts/${id}${q}`);

async function loadMilestone(milestoneId: string) {
  // RLS: only the two parties (or an admin) can read it.
  const { data } = await createClient().from('milestones').select('id, contract_id, title, status, amount_cents, contract:contracts(id, title, client_id, freelancer_id, status)').eq('id', milestoneId).maybeSingle();
  return data as unknown as { id: string; contract_id: string; title: string; status: string; amount_cents: number; contract: { id: string; title: string; client_id: string; freelancer_id: string; status: string } } | null;
}

/** Client hires a freelancer from a proposal. The veteran's fee rate is locked in at this moment. */
export async function hireFreelancer(proposalId: string) {
  const { user } = await requireRole(['employer'], '/freelance');
  const { data: p } = await createClient().from('proposals').select('id, bid_amount, status, freelancer_id, project:freelance_projects(id, title, client_id, status)').eq('id', proposalId).maybeSingle();
  const proposal = p as unknown as { id: string; bid_amount: number; status: string; freelancer_id: string; project: { id: string; title: string; client_id: string; status: string } } | null;
  if (!proposal || proposal.project.client_id !== user.id || !['submitted', 'shortlisted'].includes(proposal.status)) redirect('/freelance');
  const admin = createAdminClient();
  const [{ data: fp }, { data: vet }] = await Promise.all([
    admin.from('freelancer_profiles').select('payouts_enabled').eq('profile_id', proposal.freelancer_id).maybeSingle(),
    admin.from('veteran_profiles').select('plan').eq('profile_id', proposal.freelancer_id).maybeSingle(),
  ]);
  if (!fp?.payouts_enabled) redirect(`/freelance/projects/${proposal.project.id}?error=payouts`);
  const { data: contract, error } = await admin.from('contracts').insert({
    project_id: proposal.project.id, proposal_id: proposal.id, client_id: user.id, freelancer_id: proposal.freelancer_id,
    title: proposal.project.title, veteran_fee_rate: vetRateFor((vet?.plan as string) ?? 'free'),
  }).select('id').single();
  if (error || !contract) redirect(`/freelance/projects/${proposal.project.id}?error=save`);
  await admin.from('milestones').insert({ contract_id: contract.id, title: 'Full project', amount_cents: proposal.bid_amount * 100 });
  await admin.from('proposals').update({ status: 'accepted' }).eq('id', proposal.id);
  await admin.from('freelance_projects').update({ status: 'in_progress' }).eq('id', proposal.project.id);
  await notifyMember(proposal.freelancer_id, { type: 'contract', link: `/freelance/contracts/${contract.id}`, title: `You’re hired for “${proposal.project.title}”. Work starts once the client funds the first milestone.`,
    email: { subject: `You’re hired: ${proposal.project.title}`, preheader: 'Congratulations — here’s what happens next.', tone: 'success', badge: 'Hired',
      heading: 'Congratulations — you’re hired.', paragraphs: [`The client accepted your proposal for “${proposal.project.title}”.`, 'Wait for the milestone to show “Funded” before starting work — that means the payment is protected and held for you.'],
      cta: { label: 'Open the contract', url: `${SITE}/freelance/contracts/${contract.id}` } } });
  redirect(`/freelance/contracts/${contract.id}?hired=1`);
}

export async function addMilestone(contractId: string, formData: FormData) {
  const { user } = await requireRole(['employer'], '/freelance');
  const { data: c } = await createClient().from('contracts').select('id, client_id, status').eq('id', contractId).maybeSingle();
  if (!c || c.client_id !== user.id || c.status !== 'active') back(contractId);
  const amount = Math.round(Number(t(formData, 'amount', 9).replace(/[$,\s]/g, '')) * 100);
  const title = t(formData, 'title', 140);
  if (!Number.isFinite(amount) || amount < 2000 || title.length < 2) back(contractId, '?error=milestone');
  await createAdminClient().from('milestones').insert({ contract_id: contractId, title, amount_cents: amount });
  revalidatePath(`/freelance/contracts/${contractId}`);
  back(contractId);
}

export async function cancelMilestone(milestoneId: string) {
  const { user } = await requireRole(['employer'], '/freelance');
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
  await createAdminClient().from('milestones').update({
    status: 'submitted', submitted_at: new Date().toISOString(), submission_note: t(formData, 'note', 2000) || null, change_request: null,
    auto_release_at: new Date(Date.now() + AUTO_RELEASE_DAYS * 86400000).toISOString(),
  }).eq('id', milestoneId).eq('status', 'funded');
  await notifyMember(m.contract.client_id, { type: 'milestone', link: `/freelance/contracts/${m.contract_id}`, title: `Work submitted for “${m.title}”. Review it — it releases automatically in ${AUTO_RELEASE_DAYS} days.`,
    email: { subject: `Work submitted: ${m.title}`, preheader: `Please review within ${AUTO_RELEASE_DAYS} days.`, tone: 'notice', badge: 'Review needed',
      heading: 'Work is ready for your review.', paragraphs: [`Your freelancer submitted “${m.title}” on ${m.contract.title}.`, `Approve it to release payment, or request changes. If there’s no response in ${AUTO_RELEASE_DAYS} days, payment releases automatically.`],
      cta: { label: 'Review the work', url: `${SITE}/freelance/contracts/${m.contract_id}` } } });
  back(m.contract_id);
}

export async function requestChanges(milestoneId: string, formData: FormData) {
  const { user } = await requireRole(['employer'], '/freelance');
  const m = await loadMilestone(milestoneId);
  if (!m || m.contract.client_id !== user.id || m.status !== 'submitted') redirect('/freelance');
  await createAdminClient().from('milestones').update({ status: 'funded', auto_release_at: null, change_request: t(formData, 'changes', 2000) || 'Changes requested.' }).eq('id', milestoneId).eq('status', 'submitted');
  await notifyMember(m.contract.freelancer_id, { type: 'milestone', link: `/freelance/contracts/${m.contract_id}`, title: `Changes requested on “${m.title}”.` });
  back(m.contract_id);
}

export async function approveMilestone(milestoneId: string) {
  const { user } = await requireRole(['employer'], '/freelance');
  const m = await loadMilestone(milestoneId);
  if (!m || m.contract.client_id !== user.id || !['funded', 'submitted'].includes(m.status)) redirect('/freelance');
  const r = await releaseMilestone(milestoneId, 'approved');
  revalidatePath(`/freelance/contracts/${m.contract_id}`);
  back(m.contract_id, r.ok ? '?released=1' : `?error=${r.error}`);
}

export async function openDispute(milestoneId: string, formData: FormData) {
  const { user } = await requireRole(['employer', 'veteran'], '/freelance');
  const m = await loadMilestone(milestoneId);
  if (!m || ![m.contract.client_id, m.contract.freelancer_id].includes(user.id) || !['funded', 'submitted'].includes(m.status)) redirect('/freelance');
  const reason = t(formData, 'reason', 2000);
  if (reason.length < 10) back(m.contract_id, '?error=dispute');
  const admin = createAdminClient();
  await admin.from('milestones').update({ status: 'disputed', auto_release_at: null, dispute_reason: reason }).eq('id', milestoneId).in('status', ['funded', 'submitted']);
  await admin.from('contracts').update({ status: 'disputed' }).eq('id', m.contract_id);
  const other = user.id === m.contract.client_id ? m.contract.freelancer_id : m.contract.client_id;
  await notifyMember(other, { type: 'milestone', link: `/freelance/contracts/${m.contract_id}`, title: `A dispute was opened on “${m.title}”. LanceNest will review it — the payment stays protected meanwhile.` });
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  if (admins?.length) await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'dispute', title: `Payment dispute opened: “${m.title}” ($${(m.amount_cents / 100).toLocaleString()})`, link: '/admin/disputes' })));
  back(m.contract_id, '?disputed=1');
}

export async function leaveReview(contractId: string, revieweeId: string, formData: FormData) {
  const { user } = await requireRole(['employer', 'veteran'], '/freelance');
  const rating = Math.round(Number(formData.get('rating')));
  if (!(rating >= 1 && rating <= 5)) back(contractId, '?error=review');
  // Row-level security enforces: completed contract, you’re a party, and you’re reviewing the other party.
  await createClient().from('reviews').insert({ contract_id: contractId, reviewer_id: user.id, reviewee_id: revieweeId, rating, body: t(formData, 'body', 2000) || null });
  revalidatePath(`/freelance/contracts/${contractId}`);
  back(contractId, '?reviewed=1');
}
