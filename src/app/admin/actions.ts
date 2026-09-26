'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteMemberCompletely } from '@/lib/account';

/** Approve or reject a verification request. Role is checked BEFORE the service-role client is used. */
export async function decideVerification(requestId: string, decision: 'verified' | 'failed', formData: FormData) {
  const { user } = await requireAdmin('/admin/verifications');
  const admin = createAdminClient();
  const note = String(formData.get('note') ?? '').trim().slice(0, 300) || null;

  const { data: request } = await admin
    .from('verification_requests')
    .select('id, profile_id, document_path, status')
    .eq('id', requestId)
    .maybeSingle();
  if (!request || request.status !== 'pending') return;

  // Status change syncs to the member's profile via a database trigger.
  await admin
    .from('verification_requests')
    .update({ status: decision, reviewer_id: user.id, reviewed_at: new Date().toISOString(), notes: note, document_path: null })
    .eq('id', requestId);

  // Data minimization: the document isn't needed once a decision is made.
  if (request.document_path) await admin.storage.from('verification-docs').remove([request.document_path]);

  await admin.from('admin_actions').insert({
    admin_id: user.id,
    action: decision === 'verified' ? 'verification_approved' : 'verification_rejected',
    target_type: 'profile',
    target_id: request.profile_id,
    details: note ? { note } : {},
  });

  revalidatePath('/admin/verifications');
  revalidatePath('/admin');
}

/** Moderation: resolve or dismiss a report, optionally removing the reported post/comment. */
export async function decideReport(reportId: string, decision: 'dismissed' | 'resolved' | 'removed') {
  const { user } = await requireAdmin('/admin/reports');
  const admin = createAdminClient();
  const { data: report } = await admin.from('reports').select('id, target_type, target_id, status').eq('id', reportId).maybeSingle();
  if (!report || report.status === 'resolved' || report.status === 'dismissed') return;

  if (decision === 'removed') {
    if (report.target_type === 'post') await admin.from('network_posts').delete().eq('id', report.target_id);
    if (report.target_type === 'comment') await admin.from('post_comments').delete().eq('id', report.target_id);
    if (report.target_type === 'job') await admin.from('jobs').update({ status: 'closed' }).eq('id', report.target_id);
  }
  if (decision !== 'removed') {
    // Not a violation: bring back anything the automatic 3-report rule hid.
    if (report.target_type === 'post') await admin.from('network_posts').update({ hidden: false }).eq('id', report.target_id);
    if (report.target_type === 'comment') await admin.from('post_comments').update({ hidden: false }).eq('id', report.target_id);
    if (report.target_type === 'job') {
      // Reopen a job the report rule paused — only if its company is still verified.
      const { data: job } = await admin.from('jobs').select('company_id, status').eq('id', report.target_id).maybeSingle();
      const { data: co } = job ? await admin.from('companies').select('is_verified').eq('id', job.company_id).maybeSingle() : { data: null };
      if (job?.status === 'paused' && co?.is_verified) await admin.from('jobs').update({ status: 'open' }).eq('id', report.target_id);
    }
  }
  await admin.from('reports').update({ status: decision === 'dismissed' ? 'dismissed' : 'resolved' }).eq('id', reportId);
  await admin.from('admin_actions').insert({
    admin_id: user.id, action: `report_${decision}`, target_type: report.target_type, target_id: report.target_id, details: { report_id: reportId },
  });
  revalidatePath('/admin/reports');
  revalidatePath('/admin');
}

/** Deletes a member by email (for deletion requests sent to support). */
export async function adminDeleteMember(formData: FormData) {
  const { user } = await requireAdmin();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (String(formData.get('confirm') ?? '').trim() !== 'DELETE' || !email) redirect('/admin?deleted=confirm');
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const target = data?.users.find((u) => u.email?.toLowerCase() === email);
  if (!target) redirect('/admin?deleted=notfound');
  if (target.id === user.id) redirect('/admin?deleted=self');
  await deleteMemberCompletely(target.id);
  await admin.from('admin_actions').insert({ admin_id: user.id, action: 'member_deleted', target_type: 'profile', target_id: target.id, details: {} });
  revalidatePath('/admin');
  redirect('/admin?deleted=ok');
}

/** Company verification decisions. Rejecting or revoking pauses the company's open jobs. */
export async function decideCompany(companyId: string, decision: 'verified' | 'rejected' | 'revoked', formData: FormData) {
  const { user } = await requireAdmin();
  const admin = createAdminClient();
  const note = String(formData.get('note') ?? '').trim().slice(0, 300) || null;
  const { data: company } = await admin.from('companies').select('id, owner_id, name').eq('id', companyId).maybeSingle();
  if (!company) return;
  const verified = decision === 'verified';
  await admin.from('companies').update({ is_verified: verified, verification_status: verified ? 'verified' : 'rejected', verification_note: note }).eq('id', companyId);
  if (!verified) await admin.from('jobs').update({ status: 'paused' }).eq('company_id', companyId).eq('status', 'open');
  if (company.owner_id) {
    await admin.from('notifications').insert({
      profile_id: company.owner_id, type: 'company_verification', link: '/employer/dashboard',
      title: verified ? `${company.name} is verified — you can now publish jobs and search candidates.` : `${company.name} wasn’t verified${note ? `: ${note}` : '.'}`,
    });
  }
  await admin.from('admin_actions').insert({ admin_id: user.id, action: `company_${decision}`, target_type: 'company', target_id: companyId, details: note ? { note } : {} });
  revalidatePath('/admin/companies');
  revalidatePath('/admin');
}
