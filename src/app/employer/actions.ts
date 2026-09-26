'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { slugify } from '@/lib/format';
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
