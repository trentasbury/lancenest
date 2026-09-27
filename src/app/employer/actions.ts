'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { slugify } from '@/lib/format';
import { SITE, notifyMember } from '@/lib/email';
import { MIN_DOMAIN_AGE_DAYS, baseDomain, domainAgeDays, websiteMentions } from '@/lib/companyChecks';
import type { FormState } from '@/app/auth/actions';

export async function createCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireRole(['employer']);
  const supabase = createClient();

  const { data: existing } = await supabase.from('companies').select('id').eq('owner_id', user.id).maybeSingle();
  if (existing) return { error: 'Your account already has a company profile.' };

  const name = String(formData.get('name') ?? '').trim();
  const website = String(formData.get('website') ?? '').trim();
  if (!name) return { error: 'Enter your company name.' };
  if (website && !/^https?:\/\//i.test(website)) return { error: 'Website should start with https://' };

  const base = slugify(name) || 'company';
  const { data: taken } = await supabase.from('companies').select('id').eq('slug', base).maybeSingle();
  const slug = taken ? `${base}-${Math.random().toString(36).slice(2, 6)}` : base;

  const { error } = await supabase.from('companies').insert({
    owner_id: user.id,
    name,
    slug,
    industry: String(formData.get('industry') ?? '').trim() || null,
    headquarters: String(formData.get('headquarters') ?? '').trim() || null,
    website: website || null,
    about: String(formData.get('about') ?? '').trim() || null,
    veteran_commitment: String(formData.get('veteran_commitment') ?? '').trim() || null,
  });

  if (error) {
    console.error('createCompany failed:', error.message);
    return { error: 'We couldn’t save your company profile. Please try again.' };
  }

  revalidatePath('/employer/dashboard');
  redirect('/employer/dashboard');
}

/** Employer submits company details for review. Status can only be set to "pending" here; approval is admin-only. */
export async function submitCompanyVerification(formData: FormData) {
  const { user } = await requireRole(['employer'], '/employer/dashboard');
  const { data: company } = await createClient().from('companies').select('id, name, verification_status').eq('owner_id', user.id).maybeSingle();
  if (!company || company.verification_status === 'verified' || company.verification_status === 'pending') redirect('/employer/dashboard');
  const t = (k: string, max: number) => String(formData.get(k) ?? '').trim().slice(0, max);
  const website = t('website', 200);
  const role = t('role', 100);
  if (!/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(website) || !role || formData.get('attest') !== 'on') redirect('/employer/dashboard?verify=invalid');
  const details: Record<string, unknown> = { website, role, linkedin: t('linkedin', 200) || null, ein: t('ein', 20) || null, phone: t('phone', 30) || null,
    state: t('state', 2).toUpperCase() || null, state_id: t('state_id', 30) || null, uei: t('uei', 12).toUpperCase() || null,
    submitted_at: new Date().toISOString() };
  const admin = createAdminClient();

  // Automatic approval: the account email was confirmed at signup, so a match between its domain and the
  // company website proves control of the company's email. Personal email providers never qualify.
  const FREE_MAIL = /^(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|icloud|me|mac|aol|proton|protonmail|pm|gmx|mail|yandex|hey|fastmail)\./i;
  const emailDomain = (user.email ?? '').split('@')[1]?.toLowerCase() ?? '';
  let site = '';
  try { site = new URL(website).hostname.replace(/^www\./, '').toLowerCase(); } catch { site = ''; }
  const domainMatch = !!user.email_confirmed_at && !!site && !!emailDomain && !FREE_MAIL.test(emailDomain)
    && (emailDomain === site || emailDomain.endsWith(`.${site}`));
  // Scammers can register a fresh domain and throw up a site; they can't fake a domain's age.
  const [ageDays, siteOk] = domainMatch
    ? await Promise.all([domainAgeDays(baseDomain(site)), websiteMentions(website, company.name as string)])
    : [null, false];
  const checks = { domain_match: domainMatch, domain_age_days: ageDays, website_mentions_company: siteOk };
  Object.assign(details, { checks });
  const autoApprove = domainMatch && ageDays !== null && ageDays >= MIN_DOMAIN_AGE_DAYS && siteOk;
  if (autoApprove) {
    await admin.from('companies').update({
      verification_details: details, verification_status: 'verified', is_verified: true,
      verification_note: 'Auto-verified: confirmed work email matches the company website.',
    }).eq('id', company.id);
    await admin.from('admin_actions').insert({ admin_id: null, action: 'company_auto_verified', target_type: 'company', target_id: company.id, details: { email_domain: emailDomain, website: site, ...checks } });
    const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
    if (admins?.length) {
      await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'company_verification', title: `A company was auto-verified (work email @${emailDomain} matches its website). You can revoke it anytime.`, link: '/admin/companies' })));
    }
    await notifyMember(user.id, { type: 'company_verification', link: '/employer/dashboard', title: `${company.name} is verified — you can now publish jobs and search candidates.`,
      email: { subject: `${company.name} is verified on LanceNest`, preheader: 'Your work email matched your company website — you’re approved.', tone: 'success', badge: '✓ Verified company',
        heading: `${company.name} is verified.`,
        paragraphs: ['Your work email matched your company’s website, so you were approved automatically. Your jobs can now go live, and you can connect with verified service members.'],
        cta: { label: 'Post your first job', url: `${SITE}/employer/jobs/new` } } });
    revalidatePath('/employer/dashboard');
    redirect('/employer/dashboard?verify=auto');
  }

  await admin.from('companies').update({ verification_details: details, verification_status: 'pending', verification_note: null }).eq('id', company.id);
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  if (admins?.length) {
    await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'company_verification', title: 'A company submitted verification for review', link: '/admin/companies' })));
  }
  revalidatePath('/employer/dashboard');
  redirect('/employer/dashboard?verify=submitted');
}

/** Employer asks LanceNest to confirm their DoD SkillBridge authorization (admin checks skillbridge.osd.mil). */
export async function requestSkillBridge(formData: FormData) {
  const { user } = await requireRole(['employer'], '/employer/dashboard');
  const orgName = String(formData.get('org_name') ?? '').trim().slice(0, 160);
  const { data: company } = await createClient().from('companies').select('id, is_verified, skillbridge_status').eq('owner_id', user.id).maybeSingle();
  if (!company?.is_verified || !orgName || company.skillbridge_status === 'authorized' || company.skillbridge_status === 'pending') redirect('/employer/dashboard');
  const admin = createAdminClient();
  await admin.from('companies').update({ skillbridge_status: 'pending', skillbridge_org_name: orgName, skillbridge_note: null }).eq('id', company.id);
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  if (admins?.length) await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'skillbridge_request', title: `SkillBridge authorization to confirm: ${orgName}`, link: '/admin/companies' })));
  revalidatePath('/employer/dashboard');
  redirect('/employer/dashboard?skillbridge=requested');
}

const AGENCY_TYPES = ['Police department', 'Sheriff’s office', 'State police / highway patrol', 'Corrections', 'Fire department', 'EMS agency', 'Federal law enforcement', 'Other government public safety'];

/** A government public-safety agency asks for the Public Safety rate; an admin confirms it. */
export async function requestPublicSafety(formData: FormData) {
  const { user } = await requireRole(['employer'], '/employer/dashboard');
  const type = String(formData.get('agency_type') ?? '');
  const site = String(formData.get('official_site') ?? '').trim().slice(0, 200);
  const { data: company } = await createClient().from('companies').select('id, name, is_verified, public_safety_status').eq('owner_id', user.id).maybeSingle();
  if (!company?.is_verified || !AGENCY_TYPES.includes(type) || !/^https?:\/\//i.test(site) || ['pending', 'approved'].includes(company.public_safety_status as string)) redirect('/employer/dashboard?ps=invalid');
  const admin = createAdminClient();
  await admin.from('companies').update({ public_safety_status: 'pending', public_safety_details: { agency_type: type, official_site: site, requested_at: new Date().toISOString() } }).eq('id', company.id);
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  if (admins?.length) await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'public_safety_request', title: `Public Safety rate requested: ${company.name} (${type})`, link: '/admin/companies' })));
  revalidatePath('/employer/dashboard');
  redirect('/employer/dashboard?ps=requested');
}
