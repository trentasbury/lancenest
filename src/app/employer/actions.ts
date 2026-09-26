'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { slugify } from '@/lib/format';
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
  const { data: company } = await createClient().from('companies').select('id, verification_status').eq('owner_id', user.id).maybeSingle();
  if (!company || company.verification_status === 'verified' || company.verification_status === 'pending') redirect('/employer/dashboard');
  const t = (k: string, max: number) => String(formData.get(k) ?? '').trim().slice(0, max);
  const website = t('website', 200);
  const role = t('role', 100);
  if (!/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(website) || !role || formData.get('attest') !== 'on') redirect('/employer/dashboard?verify=invalid');
  const details = { website, role, linkedin: t('linkedin', 200) || null, ein: t('ein', 20) || null, phone: t('phone', 30) || null, submitted_at: new Date().toISOString() };
  const admin = createAdminClient();
  await admin.from('companies').update({ verification_details: details, verification_status: 'pending', verification_note: null }).eq('id', company.id);
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  if (admins?.length) {
    await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'company_verification', title: 'A company submitted verification for review', link: '/admin/companies' })));
  }
  revalidatePath('/employer/dashboard');
  redirect('/employer/dashboard?verify=submitted');
}
