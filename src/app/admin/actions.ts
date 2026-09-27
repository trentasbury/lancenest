'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteMemberCompletely } from '@/lib/account';
import { identityHash } from '@/lib/identity';

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

  // Identity check on approval: fingerprint the name + DOB typed from the document (nothing readable is stored).
  let fingerprint: string | null = null;
  if (decision === 'verified') {
    const first = String(formData.get('first') ?? '').trim();
    const last = String(formData.get('last') ?? '').trim();
    const dob = String(formData.get('dob') ?? '');
    if (!first || !last || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) redirect(`/admin/verifications?req=${requestId}&flag=missing`);
    fingerprint = identityHash(first, last, dob);
    const override = formData.get('override') === 'on';
    const [{ data: banned }, { data: dupes }] = await Promise.all([
      admin.from('banned_identities').select('removed_at, reason').eq('identity_hash', fingerprint).maybeSingle(),
      admin.from('verified_identities').select('profile_id').eq('identity_hash', fingerprint).neq('profile_id', request.profile_id).limit(1),
    ]);
    if (banned && !override) redirect(`/admin/verifications?req=${requestId}&flag=removed&on=${encodeURIComponent(banned.removed_at as string)}&why=${encodeURIComponent((banned.reason as string) ?? '')}`);
    if (dupes?.length && !override) redirect(`/admin/verifications?req=${requestId}&flag=duplicate`);
  }

  // Status change syncs to the member's profile via a database trigger.
  await admin
    .from('verification_requests')
    .update({ status: decision, reviewer_id: user.id, reviewed_at: new Date().toISOString(), notes: note, document_path: null })
    .eq('id', requestId);

  if (fingerprint) await admin.from('verified_identities').upsert({ profile_id: request.profile_id, identity_hash: fingerprint });

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

/** Confirm (or reject) a company's DoD SkillBridge authorization after checking skillbridge.osd.mil. */
export async function decideSkillBridge(companyId: string, decision: 'authorized' | 'rejected') {
  const { user } = await requireAdmin();
  const admin = createAdminClient();
  const { data: c } = await admin.from('companies').select('owner_id, name').eq('id', companyId).maybeSingle();
  await admin.from('companies').update({ skillbridge_status: decision }).eq('id', companyId);
  if (decision === 'rejected') await admin.from('jobs').update({ status: 'paused' }).eq('company_id', companyId).eq('employment_type', 'skillbridge').eq('status', 'open');
  if (c?.owner_id) await admin.from('notifications').insert({ profile_id: c.owner_id, type: 'skillbridge_request', link: '/employer/dashboard',
    title: decision === 'authorized' ? `${c.name} is confirmed for SkillBridge listings.` : `We couldn’t confirm ${c.name} on the official DoD SkillBridge list.` });
  await admin.from('admin_actions').insert({ admin_id: user.id, action: `skillbridge_${decision}`, target_type: 'company', target_id: companyId, details: {} });
  revalidatePath('/admin/companies');
}

/** Conduct enforcement. Every action is logged to the member's record and to admin_actions. */
export async function actOnMember(profileId: string, action: 'warning' | 'suspension' | 'removal' | 'reinstated', formData: FormData) {
  const { user } = await requireAdmin('/admin/members');
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 500);
  if (reason.length < 3) redirect(`/admin/members?id=${profileId}&err=reason`);
  if (profileId === user.id) redirect('/admin/members');
  const admin = createAdminClient();
  const reportId = String(formData.get('report_id') ?? '') || null;

  if (action === 'suspension') {
    await admin.from('profiles').update({ suspended_until: new Date(Date.now() + 7 * 86400000).toISOString() }).eq('id', profileId);
  } else if (action === 'removal') {
    await admin.from('profiles').update({ banned: true }).eq('id', profileId);
    const { data: ident } = await admin.from('verified_identities').select('identity_hash').eq('profile_id', profileId).maybeSingle();
    if (ident) await admin.from('banned_identities').upsert({ identity_hash: ident.identity_hash, reason });
    await admin.auth.admin.updateUserById(profileId, { ban_duration: '876000h' }); // blocks sign-in
    await admin.from('network_posts').update({ hidden: true }).eq('author_id', profileId);
    await admin.from('post_comments').update({ hidden: true }).eq('author_id', profileId);
    const { data: cos } = await admin.from('companies').select('id').eq('owner_id', profileId);
    if (cos?.length) await admin.from('jobs').update({ status: 'paused' }).in('company_id', cos.map((c) => c.id)).eq('status', 'open');
  } else if (action === 'reinstated') {
    await admin.from('profiles').update({ banned: false, suspended_until: null }).eq('id', profileId);
    await admin.auth.admin.updateUserById(profileId, { ban_duration: 'none' });
    await admin.from('network_posts').update({ hidden: false }).eq('author_id', profileId);
  }
  await admin.from('member_strikes').insert({ profile_id: profileId, level: action, reason, report_id: reportId, issued_by: user.id });
  await admin.from('admin_actions').insert({ admin_id: user.id, action: `member_${action}`, target_type: 'profile', target_id: profileId, details: { reason } });
  if (action !== 'removal') {
    await admin.from('notifications').insert({ profile_id: profileId, type: 'conduct', link: '/settings/account',
      title: action === 'warning' ? `Conduct warning: ${reason}` : action === 'suspension' ? `Your account is suspended for 7 days: ${reason}` : 'Your account has been reinstated.' });
  }
  if (reportId) await admin.from('reports').update({ status: 'resolved' }).eq('id', reportId);
  revalidatePath('/admin/members');
  redirect(`/admin/members?id=${profileId}&done=${action}`);
}
