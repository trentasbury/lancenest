'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireVerifiedMember } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMyCompany } from '@/lib/employer';
import { notifyMember } from '@/lib/email';

const t = (f: FormData, k: string, max: number) => String(f.get(k) ?? '').trim().slice(0, max);
const back = (slug: string, q = '') => `/companies/${encodeURIComponent(slug)}${q}`;
const MAX_WORKPLACES = 5;
// Same idea as the freelance contact guard: ratings and titles are not a place for phone numbers, emails or links.
const CONTACT = /[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z]{2,}|https?:\/\/|www\.|\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/i;

async function companyBySlug(slug: string) {
  const { data } = await createAdminClient().from('companies').select('id, slug, name, owner_id').eq('slug', slug).maybeSingle();
  return data as { id: string; slug: string; name: string; owner_id: string | null } | null;
}

/** A verified member says they work (or worked) here. */
export async function addWorkplace(slug: string, formData: FormData) {
  const { user, profile } = await requireVerifiedMember(back(slug));
  if (profile.role !== 'veteran') redirect(back(slug));
  const company = await companyBySlug(slug);
  if (!company) redirect('/companies');
  const title = t(formData, 'title', 120) || null;
  if (title && CONTACT.test(title)) redirect(back(slug, '?work=contact#people'));
  const admin = createAdminClient();
  const { count } = await admin.from('company_people').select('company_id', { count: 'exact', head: true }).eq('profile_id', user.id);
  const { data: existing } = await admin.from('company_people').select('company_id').eq('profile_id', user.id).eq('company_id', company.id).maybeSingle();
  if (!existing && (count ?? 0) >= MAX_WORKPLACES) redirect(back(slug, '?work=limit#people'));
  await admin.from('company_people').upsert({
    profile_id: user.id, company_id: company.id, title,
    is_current: formData.get('is_current') !== 'past',
    open_to_referrals: formData.get('open_to_referrals') === 'on',
  }, { onConflict: 'profile_id,company_id' });
  revalidatePath(back(slug));
  redirect(back(slug, '?work=saved#people'));
}

export async function removeWorkplace(slug: string) {
  const { user } = await requireVerifiedMember(back(slug));
  const company = await companyBySlug(slug);
  if (company) await createAdminClient().from('company_people').delete().eq('profile_id', user.id).eq('company_id', company.id);
  revalidatePath(back(slug));
  redirect(back(slug, '#people'));
}

/** Rate an employer. Only verified members who list this company as a current or past workplace. One rating each, editable. */
export async function rateCompany(slug: string, formData: FormData) {
  const { user, profile } = await requireVerifiedMember(back(slug));
  if (profile.role !== 'veteran') redirect(back(slug));
  const company = await companyBySlug(slug);
  if (!company) redirect('/companies');
  const admin = createAdminClient();
  const { data: work } = await admin.from('company_people').select('is_current').eq('profile_id', user.id).eq('company_id', company.id).maybeSingle();
  if (!work) redirect(back(slug, '?rate=workplace#ratings'));
  const num = (k: string) => Math.round(Number(formData.get(k)));
  const overall = num('overall');
  const support = num('veteran_support');
  const recommend = formData.get('recommend');
  if (!(overall >= 1 && overall <= 5) || !(support >= 1 && support <= 5) || (recommend !== 'yes' && recommend !== 'no')) redirect(back(slug, '?rate=missing#ratings'));
  const pros = t(formData, 'pros', 1000) || null;
  const cons = t(formData, 'cons', 1000) || null;
  if ([pros, cons].some((x) => x && CONTACT.test(x))) redirect(back(slug, '?rate=contact#ratings'));
  if (formData.get('honest') !== 'on') redirect(back(slug, '?rate=honest#ratings'));
  const { error } = await admin.from('company_ratings').upsert({
    company_id: company.id, profile_id: user.id, overall, veteran_support: support, recommend: recommend === 'yes',
    pros, cons, was_current: work.is_current, updated_at: new Date().toISOString(),
  }, { onConflict: 'company_id,profile_id' });
  if (error?.code === 'P0022') redirect(back(slug, '?rate=explicit#ratings'));
  if (error) { console.error('rateCompany failed:', error.message); redirect(back(slug, '?rate=error#ratings')); }
  if (company.owner_id) await notifyMember(company.owner_id, { type: 'rating', link: back(slug, '#ratings'), title: `A verified veteran rated ${company.name} on LanceNest. You can read it and respond on your company page.` });
  revalidatePath(back(slug));
  redirect(back(slug, '?rate=saved#ratings'));
}

/** The employer's public reply to one rating (they never see who wrote it). */
export async function respondToRating(slug: string, ratingId: string, formData: FormData) {
  const { user } = await requireVerifiedMember(back(slug));
  const company = await companyBySlug(slug);
  const mine = await getMyCompany(user.id);
  if (!company || !mine || mine.id !== company.id) redirect(back(slug));
  const text = t(formData, 'response', 1000);
  if (text && CONTACT.test(text)) redirect(back(slug, '?rate=contact#ratings'));
  await createAdminClient().from('company_ratings').update({ employer_response: text || null, responded_at: text ? new Date().toISOString() : null })
    .eq('id', ratingId).eq('company_id', company.id);
  revalidatePath(back(slug));
  redirect(back(slug, '?rate=responded#ratings'));
}
