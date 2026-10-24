'use server';

import { stripImageMetadata } from '@/lib/imageMeta';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { siteHost } from '@/lib/applyLinks';

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Logo (every verified company) or cover photo (Professional and above), stored in the company's own folder. */
export async function uploadCompanyImage(kind: 'logo' | 'cover', formData: FormData) {
  const { user } = await requireRole(['employer'], '/employer/company');
  const supabase = await createClient();
  const { data: company } = await supabase.from('companies').select('id, slug, plan, is_verified').eq('owner_id', user.id).maybeSingle();
  if (!company?.is_verified) redirect('/employer/dashboard?verify=required');
  if (kind === 'cover' && !['professional', 'federal', 'enterprise'].includes(company.plan as string)) redirect('/employer/company?error=plan');
  const file = formData.get('file');
  if (!(file instanceof File) || !TYPES[file.type]) redirect('/employer/company?error=type');
  if (file.size > 2 * 1024 * 1024) redirect('/employer/company?error=size');
  const path = `${user.id}/${kind}-${Date.now()}.${TYPES[file.type]}`;
  const clean = stripImageMetadata(new Uint8Array(await file.arrayBuffer()));
  if (!clean) redirect('/employer/company?error=type');
  const { error } = await supabase.storage.from('company-logos').upload(path, clean, { contentType: file.type });
  if (error) redirect('/employer/company?error=upload');
  const url = supabase.storage.from('company-logos').getPublicUrl(path).data.publicUrl;
  await createAdminClient().from('companies').update(kind === 'logo' ? { logo_url: url } : { cover_url: url }).eq('id', company.id);
  revalidatePath(`/companies/${company.slug}`);
  redirect('/employer/company?saved=1');
}

export async function saveCommitment(formData: FormData) {
  const { user } = await requireRole(['employer'], '/employer/company');
  const { data: c } = await (await createClient()).from('companies').update({ veteran_commitment: String(formData.get('veteran_commitment') ?? '').trim().slice(0, 2000) || null }).eq('owner_id', user.id).select('slug').maybeSingle();
  if (c?.slug) revalidatePath(`/companies/${c.slug}`);
  redirect('/employer/company?saved=1');
}

/**
 * Company details shown on the public company page (like a LinkedIn company page).
 * Once a company has given its website for verification, the public website must stay on that domain;
 * the company name is locked after verification so a verified badge can't be moved to another name.
 */
export async function saveCompanyDetails(formData: FormData) {
  const { user } = await requireRole(['employer'], '/employer/company');
  const admin = createAdminClient();
  const { data: company } = await admin.from('companies').select('id, slug, is_verified, verification_details').eq('owner_id', user.id).maybeSingle();
  if (!company) redirect('/employer/dashboard');
  const t = (k: string, max: number) => String(formData.get(k) ?? '').trim().slice(0, max);
  let website = t('website', 300);
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  let host = '';
  if (website) {
    try { const u = new URL(website); host = u.hostname.toLowerCase().replace(/^www\./, ''); if (u.protocol !== 'https:' || !host.includes('.')) throw new Error(); }
    catch { redirect('/employer/company?error=website'); }
  }
  const verifiedHost = siteHost((company.verification_details as { website?: string } | null)?.website);
  if (website && verifiedHost && host !== verifiedHost && !host.endsWith(`.${verifiedHost}`)) redirect('/employer/company?error=domain');
  const name = t('name', 120);
  const fields: Record<string, string | null> = {
    website: website || null,
    industry: t('industry', 80) || null,
    headquarters: t('headquarters', 120) || null,
    about: t('about', 4000) || null,
    mission: t('mission', 2000) || null,
    benefits: t('benefits', 2000) || null,
  };
  if (!company.is_verified && name) fields.name = name;
  const { error } = await (await createClient()).from('companies').update(fields).eq('id', company.id).eq('owner_id', user.id);
  if (error) { console.error('saveCompanyDetails failed:', error.message); redirect('/employer/company?error=details'); }
  revalidatePath(`/companies/${company.slug}`);
  redirect('/employer/company?saved=details');
}

/**
 * Employer commitments shown as badges. The Guard & Reserve pledge is the employer's own promise. MSEP partnership
 * is checked by an admin against the public partner list before the badge appears.
 */
export async function saveCommitments(formData: FormData) {
  const { user } = await requireRole(['employer'], '/employer/company');
  const admin = createAdminClient();
  const { data: c } = await admin.from('companies').select('id, slug, name, is_verified, msep_status').eq('owner_id', user.id).maybeSingle();
  if (!c?.is_verified) redirect('/employer/dashboard?verify=required');
  const pledge = formData.get('guard_reserve') === 'on';
  const wantsMsep = formData.get('msep') === 'on';
  // A rejected request stays rejected (so the admin queue can't be refilled by toggling); support can reopen it.
  const msep = c.msep_status === 'rejected' ? 'rejected' : wantsMsep ? (c.msep_status === 'verified' ? 'verified' : 'pending') : 'none';
  await admin.from('companies').update({ guard_reserve_pledge: pledge, msep_status: msep }).eq('id', c.id);
  if (msep === 'pending' && c.msep_status !== 'pending') {
    const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
    if (admins?.length) await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'company_review', title: `${c.name} says it's an MSEP partner. Check the public list.`, link: '/admin/companies' })));
  }
  revalidatePath(`/companies/${c.slug}`);
  redirect('/employer/company?saved=1');
}
