'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Logo (every verified company) or cover photo (Professional and above), stored in the company's own folder. */
export async function uploadCompanyImage(kind: 'logo' | 'cover', formData: FormData) {
  const { user } = await requireRole(['employer'], '/employer/company');
  const supabase = createClient();
  const { data: company } = await supabase.from('companies').select('id, slug, plan, is_verified').eq('owner_id', user.id).maybeSingle();
  if (!company?.is_verified) redirect('/employer/dashboard?verify=required');
  if (kind === 'cover' && !['professional', 'federal', 'enterprise'].includes(company.plan as string)) redirect('/employer/company?error=plan');
  const file = formData.get('file');
  if (!(file instanceof File) || !TYPES[file.type]) redirect('/employer/company?error=type');
  if (file.size > 2 * 1024 * 1024) redirect('/employer/company?error=size');
  const path = `${user.id}/${kind}-${Date.now()}.${TYPES[file.type]}`;
  const { error } = await supabase.storage.from('company-logos').upload(path, file, { contentType: file.type });
  if (error) redirect('/employer/company?error=upload');
  const url = supabase.storage.from('company-logos').getPublicUrl(path).data.publicUrl;
  await createAdminClient().from('companies').update(kind === 'logo' ? { logo_url: url } : { cover_url: url }).eq('id', company.id);
  revalidatePath(`/companies/${company.slug}`);
  redirect('/employer/company?saved=1');
}

export async function saveCommitment(formData: FormData) {
  const { user } = await requireRole(['employer'], '/employer/company');
  await createClient().from('companies').update({ veteran_commitment: String(formData.get('veteran_commitment') ?? '').trim().slice(0, 2000) || null }).eq('owner_id', user.id);
  redirect('/employer/company?saved=1');
}
