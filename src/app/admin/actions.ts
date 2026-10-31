'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { rewardReferrer } from '@/lib/referrals';
import { deleteMemberCompletely, deletionBlocker } from '@/lib/account';
import { identityHash } from '@/lib/identity';
import { SITE, notifyMember } from '@/lib/email';
import { refreshPublicJobs } from '@/lib/publicRefresh';

/** Approve or reject a verification request. Role is checked BEFORE the service-role client is used. */
export async function decideVerification(requestId: string, decision: 'verified' | 'failed', formData: FormData) {
  const { user } = await requireAdmin('/admin/verifications');
  const admin = createAdminClient();
  const note = String(formData.get('note') ?? '').trim().slice(0, 300) || null;

  const { data: request } = await admin
    .from('verification_requests')
    .select('id, profile_id, document_path, id_document_path, status')
    .eq('id', requestId)
    .maybeSingle();
  if (!request || request.status !== 'pending') return;
  const { data: who } = await admin.from('veteran_profiles').select('member_type, verification_status').eq('profile_id', request.profile_id).maybeSingle();
  const spouse = who?.member_type === 'spouse';
  const renewal = spouse && who?.verification_status === 'verified';

  // Discharge rule (service members): Honorable, General, uncharacterized, or still serving. Other Than Honorable is
  // approved case by case with a reason; Bad Conduct and Dishonorable are rejected. Only the outcome is logged.
  const discharge = String(formData.get('discharge') ?? '');
  const othNote = String(formData.get('oth_note') ?? '').trim().slice(0, 300);
  if (decision === 'verified' && !spouse && !renewal) {
    if (discharge !== 'eligible' && discharge !== 'oth_approved') redirect(`/admin/verifications?req=${requestId}&flag=discharge`);
    if (discharge === 'oth_approved' && othNote.length < 10) redirect(`/admin/verifications?req=${requestId}&flag=oth`);
  }
  // Separation or ETS date shown on the documents (optional). Free transition Pro only uses a date confirmed here.
  const sepRaw = String(formData.get('sep_date') ?? '');
  const sepDate = /^\d{4}-\d{2}-\d{2}$/.test(sepRaw) && !spouse ? sepRaw : null;

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
    .update({ status: decision, reviewer_id: user.id, reviewed_at: new Date().toISOString(), notes: note, document_path: null, id_document_path: null })
    .eq('id', requestId);

  if (fingerprint) await admin.from('verified_identities').upsert({ profile_id: request.profile_id, identity_hash: fingerprint });

  // Data minimization: neither file is needed once a decision is made.
  const files = [request.document_path, request.id_document_path].filter((p): p is string => typeof p === 'string' && p.length > 0);
  if (files.length) await admin.storage.from('verification-docs').remove(files);

  await admin.from('admin_actions').insert({
    admin_id: user.id,
    action: decision === 'verified' ? 'verification_approved' : 'verification_rejected',
    target_type: 'profile',
    target_id: request.profile_id,
    details: {
      ...(note ? { note } : {}),
      ...(decision === 'verified' && discharge === 'oth_approved' ? { discharge: 'oth_reviewed', reason: othNote } : {}),
      ...(renewal ? { renewal: true } : {}),
    },
  });

  if (decision === 'verified' && sepDate) {
    await admin.from('veteran_profiles').update({ separation_verified_on: sepDate, separation_date: sepDate }).eq('profile_id', request.profile_id);
  }
  if (decision === 'verified' && spouse) {
    // A spouse verified (or re-verified) by documents is good for another year; a surviving spouse never expires.
    const year = new Date(Date.now() + 365 * 86400000).toISOString();
    const surviving = formData.get('surviving') === 'on';
    const { data: link } = await admin.from('spouse_links').select('spouse_id').eq('spouse_id', request.profile_id).maybeSingle();
    if (link) await admin.from('spouse_links').update({ confirmed_until: year, grace_until: null, reminded_at: null, ...(surviving ? { surviving: true } : {}) }).eq('spouse_id', request.profile_id);
    else await admin.from('spouse_links').insert({ spouse_id: request.profile_id, sponsor_id: null, method: 'documents', confirmed_until: year, surviving });
  }
  // A renewal that didn't pass leaves the member verified until their grace period ends; tell them, then stop.
  if (renewal) {
    await notifyMember(request.profile_id, decision === 'verified'
      ? { type: 'verification', link: '/dashboard', title: 'Your military spouse status is renewed for another year. Thank you.' }
      : { type: 'verification', link: '/dashboard/verification', title: `We couldn’t renew your spouse status with those documents${note ? `: ${note}` : '.'} Please try again before your grace period ends.` });
    revalidatePath('/admin/verifications');
    return;
  }
  if (decision === 'verified') await rewardReferrer(request.profile_id, 'member_active');
  await notifyMember(request.profile_id, decision === 'verified'
    ? { type: 'verification', link: '/dashboard', title: 'You’re verified ✓ — jobs, the network, messaging, and freelance are unlocked.',
        email: { subject: 'You’re verified on LanceNest', preheader: 'Jobs, the network, messaging, and freelance are now unlocked.', tone: 'success', badge: spouse ? '✓ Verified military spouse' : '✓ Verified service member',
          heading: spouse ? 'Welcome aboard — you’re verified.' : 'Welcome aboard — your service is verified.',
          paragraphs: [spouse ? 'Thank you for everything your family gives. Your Verified badge is now on your profile, and everything on LanceNest is unlocked: jobs, the Network, messaging, and freelance work.' : 'Thank you for your service. Your Verified badge is now on your profile, and everything on LanceNest is unlocked: jobs, the Network, messaging, and freelance work.',
            'Your documents and photo ID have been permanently deleted, as promised.',
            'Next step: complete your profile — members with a résumé and military career filled in hear from employers far more often.'],
          cta: { label: 'Go to your dashboard', url: `${SITE}/dashboard` } } }
    : { type: 'verification', link: '/dashboard/verification', title: `We couldn’t verify your documents${note ? `: ${note}` : '.'} Please resubmit.`,
        email: { subject: 'Action needed: your LanceNest verification', preheader: 'We couldn’t verify your documents — here’s how to fix it.', tone: 'alert', badge: 'Action needed',
          heading: 'We couldn’t verify your documents yet.',
          paragraphs: [note ? `Reason: ${note}` : 'The documents didn’t meet our requirements.',
            'For your privacy, the files you sent have already been permanently deleted.',
            'You can resubmit anytime — it only takes a couple of minutes. Remember to black out your Social Security number and cover your ID number first.'],
          cta: { label: 'Resubmit verification', url: `${SITE}/dashboard/verification` } } });

  // Leaving the service within a year? Free Pro for the transition (does nothing otherwise).
  if (decision === 'verified') { const { grantTransitionPro } = await import('@/lib/transitionPro'); await grantTransitionPro(request.profile_id); }

  revalidatePath('/admin/verifications');
  revalidatePath('/admin');
}

/**
 * A verified member's separation date check (orders, LES or DD-214). Approving confirms the date, which is what free
 * transition Pro uses; the document is deleted either way.
 */
export async function decideSeparationCheck(checkId: string, decision: 'approved' | 'rejected', formData: FormData) {
  const { user } = await requireAdmin('/admin/verifications');
  const admin = createAdminClient();
  const { data: c } = await admin.from('separation_checks').select('id, profile_id, document_path, status, requested_date').eq('id', checkId).maybeSingle();
  if (!c || c.status !== 'pending') return;
  const dateRaw = String(formData.get('confirmed_date') ?? '');
  const confirmed = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : null;
  const note = String(formData.get('note') ?? '').trim().slice(0, 300) || null;
  if (decision === 'approved' && !confirmed) redirect(`/admin/verifications?sep=${checkId}&flag=sep_date`);

  await admin.from('separation_checks').update({
    status: decision, confirmed_date: decision === 'approved' ? confirmed : null, note, reviewer_id: user.id, reviewed_at: new Date().toISOString(), document_path: null,
  }).eq('id', checkId);
  if (c.document_path) await admin.storage.from('verification-docs').remove([c.document_path as string]);
  await admin.from('admin_actions').insert({ admin_id: user.id, action: `separation_check_${decision}`, target_type: 'profile', target_id: c.profile_id, details: note ? { note } : {} });

  if (decision === 'approved') {
    await admin.from('veteran_profiles').update({ separation_verified_on: confirmed, separation_date: confirmed }).eq('profile_id', c.profile_id);
    const { grantTransitionPro } = await import('@/lib/transitionPro');
    const granted = await grantTransitionPro(c.profile_id as string);
    if (!granted) await notifyMember(c.profile_id as string, { type: 'verification', link: '/transition', title: 'Your separation date is confirmed. Your Transition Hub timeline now uses it.' });
  } else {
    await notifyMember(c.profile_id as string, { type: 'verification', link: '/transition',
      title: `We couldn’t confirm your separation date${note ? `: ${note}` : '.'} The file was deleted; you can send another from the Transition Hub.` });
  }
  revalidatePath('/admin/verifications');
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
    if (report.target_type === 'rating') await admin.from('company_ratings').update({ status: 'hidden' }).eq('id', report.target_id);
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
  // Look through every page of accounts (one page holds 1,000).
  let target: { id: string } | undefined;
  for (let page = 1; page <= 100 && !target; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    target = data?.users.find((u) => u.email?.toLowerCase() === email);
    if (!data || data.users.length < 1000) break;
  }
  if (!target) redirect('/admin?deleted=notfound');
  if (target.id === user.id) redirect('/admin?deleted=self');
  const blocked = await deletionBlocker(target.id, false);
  if (blocked) redirect(`/admin?deleted=${blocked}`);
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
  refreshPublicJobs();
  if (!verified) await admin.from('jobs').update({ status: 'paused' }).eq('company_id', companyId).eq('status', 'open');
  if (company.owner_id) {
    const name = company.name as string;
    await notifyMember(company.owner_id as string, verified
      ? { type: 'company_verification', link: '/employer/dashboard', title: `${name} is verified — you can now publish jobs and search candidates.`,
          email: { subject: `${name} is verified on LanceNest`, preheader: 'You can now publish jobs and connect with verified service members.', tone: 'success', badge: '✓ Verified company',
            heading: `${name} is verified.`,
            paragraphs: ['Your company is approved on LanceNest. Your jobs can now go live, and you can connect with verified service members.',
              'Any drafts you saved are ready to publish from your employer dashboard.'],
            cta: { label: 'Open your employer dashboard', url: `${SITE}/employer/dashboard` } } }
      : { type: 'company_verification', link: '/employer/dashboard', title: `${name} ${decision === 'revoked' ? 'is no longer verified' : 'wasn’t verified'}${note ? `: ${note}` : '.'}`,
          email: { subject: decision === 'revoked' ? `${name}’s verification was removed` : `Action needed: ${name}’s verification`, tone: 'alert', badge: 'Action needed',
            preheader: 'Here’s what happened and what you can do.',
            heading: decision === 'revoked' ? `${name} is no longer verified.` : `We couldn’t verify ${name} yet.`,
            paragraphs: [note ? `Reason: ${note}` : 'We weren’t able to confirm the company details provided.',
              decision === 'revoked' ? 'Your open jobs have been paused while this is reviewed.' : 'You can update your details and resubmit from your dashboard — a state business ID or SAM.gov UEI makes review fastest.',
              'Questions or want to appeal? Send us a message through the Help page (lancenest.com/help) or reply to this email.'],
            cta: { label: 'Go to your dashboard', url: `${SITE}/employer/dashboard` } } });
  }
  await admin.from('admin_actions').insert({ admin_id: user.id, action: `company_${decision}`, target_type: 'company', target_id: companyId, details: note ? { note } : {} });
  revalidatePath('/admin/companies');
  revalidatePath('/admin');
}

/** Confirm (or reject) a company's DoD SkillBridge authorization after checking skillbridge.osd.mil. */
/** MSEP partner badge: confirmed only after checking the DoD's public MSEP partner list. */
export async function decideMsep(companyId: string, decision: 'verified' | 'rejected') {
  const { user } = await requireAdmin();
  const admin = createAdminClient();
  const { data: c } = await admin.from('companies').select('owner_id, name, slug').eq('id', companyId).maybeSingle();
  await admin.from('companies').update({ msep_status: decision }).eq('id', companyId);
  await admin.from('admin_actions').insert({ admin_id: user.id, action: `msep_${decision}`, target_type: 'company', target_id: companyId, details: {} });
  if (c?.owner_id) await admin.from('notifications').insert({ profile_id: c.owner_id, type: 'company_review', link: '/employer/company',
    title: decision === 'verified' ? `${c.name} now shows the Military Spouse Employment Partner badge.` : `We couldn’t find ${c.name} on the public MSEP partner list, so the badge isn’t shown.` });
  if (c?.slug) revalidatePath(`/companies/${c.slug}`);
  revalidatePath('/admin/companies');
}

export async function decideSkillBridge(companyId: string, decision: 'authorized' | 'rejected') {
  const { user } = await requireAdmin();
  const admin = createAdminClient();
  const { data: c } = await admin.from('companies').select('owner_id, name').eq('id', companyId).maybeSingle();
  await admin.from('companies').update({ skillbridge_status: decision }).eq('id', companyId);
  if (decision === 'rejected') await admin.from('jobs').update({ status: 'paused' }).eq('company_id', companyId).eq('employment_type', 'skillbridge').eq('status', 'open');
  if (c?.owner_id) await notifyMember(c.owner_id as string, {
    type: 'skillbridge_request', link: '/employer/dashboard',
    title: decision === 'authorized' ? `${c.name} is confirmed for SkillBridge listings.` : `We couldn’t confirm ${c.name} on the official DoD SkillBridge list.`,
    email: decision === 'authorized'
      ? { subject: 'You can now list SkillBridge programs', preheader: 'Your DoD SkillBridge authorization is confirmed.', tone: 'success', badge: '✓ SkillBridge confirmed',
          heading: 'Your SkillBridge listings are unlocked.',
          paragraphs: [`${c.name} is confirmed on the official DoD SkillBridge list. Post a program by choosing “SkillBridge” as the employment type.`,
            'Reminder: SkillBridge participants keep their military pay, so listings never show a salary.'],
          cta: { label: 'Post a SkillBridge program', url: `${SITE}/employer/jobs/new` } }
      : { subject: 'About your SkillBridge request', preheader: 'We couldn’t find your organization on the DoD list.', tone: 'notice', badge: 'SkillBridge',
          heading: 'We couldn’t confirm your SkillBridge authorization.',
          paragraphs: [`We couldn’t find ${c.name} on the official DoD SkillBridge directory. If your organization is listed under a different name, send us that exact name through the Help page (lancenest.com/help) and we’ll recheck.`,
            'You can still hire transitioning members for roles that start after they separate.'],
          cta: { label: 'Open your dashboard', url: `${SITE}/employer/dashboard` } },
  });
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
  const CONDUCT = {
    warning: ['Conduct warning on your LanceNest account', 'A formal warning was added to your account.', 'This is a formal warning under our Code of Conduct. A second violation results in a 7-day suspension.'],
    suspension: ['Your LanceNest account is suspended for 7 days', 'Your account is suspended for 7 days.', 'You won’t be able to use LanceNest during the suspension. A further violation results in removal.'],
    removal: ['Your LanceNest account has been removed', 'Your account has been removed.', 'Your account was permanently removed for violating our Code of Conduct.'],
    reinstated: ['Your LanceNest account is reinstated', 'Welcome back — your account is reinstated.', 'Your account is active again. Thank you for your patience.'],
  }[action];
  await notifyMember(profileId, {
    type: 'conduct', link: '/settings/account', inApp: action !== 'removal',
    title: action === 'warning' ? `Conduct warning: ${reason}` : action === 'suspension' ? `Your account is suspended for 7 days: ${reason}` : action === 'reinstated' ? 'Your account has been reinstated.' : 'Your account was removed.',
    email: { subject: CONDUCT[0], preheader: CONDUCT[1], tone: action === 'reinstated' ? 'success' : 'alert', badge: action === 'reinstated' ? 'Reinstated' : 'Code of Conduct',
      heading: CONDUCT[1],
      paragraphs: [...(action === 'reinstated' ? [] : [`Reason: ${reason}`]), CONDUCT[2], 'To appeal, write to us within 30 days through the Help page (lancenest.com/help) or reply to this email.'],
      cta: action === 'removal' ? { label: 'Read the Code of Conduct', url: `${SITE}/conduct` } : { label: 'View your account', url: `${SITE}/settings/account` } },
  });
  if (reportId) await admin.from('reports').update({ status: 'resolved' }).eq('id', reportId);
  revalidatePath('/admin/members');
  redirect(`/admin/members?id=${profileId}&done=${action}`);
}

/** Approve or decline the Public Safety rate after confirming the agency is a government public-safety organization. */
export async function decidePublicSafety(companyId: string, decision: 'approved' | 'rejected') {
  const { user } = await requireAdmin('/admin/companies');
  const admin = createAdminClient();
  const { data: c } = await admin.from('companies').select('owner_id, name').eq('id', companyId).maybeSingle();
  await admin.from('companies').update({ public_safety_status: decision }).eq('id', companyId);
  await admin.from('admin_actions').insert({ admin_id: user.id, action: `public_safety_${decision}`, target_type: 'company', target_id: companyId, details: {} });
  if (c?.owner_id) await notifyMember(c.owner_id as string, {
    type: 'public_safety_request', link: '/employers',
    title: decision === 'approved' ? `${c.name} qualifies for the Public Safety rate — 30% off Professional and Federal.` : `We couldn’t confirm ${c.name} for the Public Safety rate.`,
    email: decision === 'approved'
      ? { subject: 'Your Public Safety rate is active', preheader: '30% off Professional and Federal, for as long as you subscribe.', tone: 'success', badge: 'Public Safety rate',
          heading: 'Thank you for serving your community.',
          paragraphs: [`${c.name} is approved for the LanceNest Public Safety rate: 30% off Professional and Federal, for as long as you’re subscribed. It’s applied automatically at checkout.`,
            'Need annual invoice billing instead of a card? Tell us through the Help page (lancenest.com/help) or reply to this email, and we’ll set it up.'],
          cta: { label: 'See plans', url: `${SITE}/employers` } }
      : { subject: 'About your Public Safety rate request', preheader: 'We couldn’t confirm eligibility.', tone: 'notice', badge: 'Public Safety rate',
          heading: 'We couldn’t confirm eligibility yet.',
          paragraphs: ['The Public Safety rate is for government police, sheriff, corrections, fire, and EMS agencies. If that’s you, send your agency’s official .gov page through the Help page (lancenest.com/help) and we’ll take another look.'],
          cta: { label: 'Open your dashboard', url: `${SITE}/employer/dashboard` } },
  });
  revalidatePath('/admin/companies');
}

/** Dispute resolution: pay the freelancer or refund the client. Logged. */
export async function resolveDispute(milestoneId: string, outcome: 'release' | 'refund', formData: FormData) {
  const { user } = await requireAdmin('/admin/disputes');
  const note = String(formData.get('note') ?? '').trim().slice(0, 500);
  const { releaseMilestone, refundMilestone } = await import('@/lib/payments');
  const r = outcome === 'release' ? await releaseMilestone(milestoneId, 'dispute') : await refundMilestone(milestoneId);
  const admin = createAdminClient();
  if (r.ok) {
    const { data: m } = await admin.from('milestones').select('contract_id').eq('id', milestoneId).maybeSingle();
    if (m) await admin.from('contracts').update({ status: 'active' }).eq('id', m.contract_id).eq('status', 'disputed');
    if (m) { const { completeIfDone } = await import('@/lib/payments'); await completeIfDone(m.contract_id as string); }
  }
  await admin.from('admin_actions').insert({ admin_id: user.id, action: `dispute_${outcome}`, target_type: 'milestone', target_id: milestoneId, details: { note, ok: r.ok } });
  revalidatePath('/admin/disputes');
  redirect(`/admin/disputes?done=${r.ok ? outcome : 'failed'}`);
}
