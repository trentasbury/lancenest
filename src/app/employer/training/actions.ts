'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { TRAINING_CATEGORIES } from '@/lib/training';

const t = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? '').trim().slice(0, max);

async function myCompanyId(userId: string) {
  const { data } = await createClient().from('companies').select('id').eq('owner_id', userId).maybeSingle();
  if (!data) redirect('/employer/dashboard');
  return data.id as string;
}

export async function saveProgram(formData: FormData) {
  const { user } = await requireRole(['employer'], '/employer/training');
  const companyId = await myCompanyId(user.id);
  const category = t(formData, 'category', 60);
  const format = t(formData, 'format', 10);
  const url = t(formData, 'url', 300);
  const fields = {
    company_id: companyId, title: t(formData, 'title', 140), category: TRAINING_CATEGORIES.includes(category) ? category : 'Other',
    description: t(formData, 'description', 4000), format: ['online', 'in_person', 'hybrid'].includes(format) ? format : 'online',
    location: t(formData, 'location', 120) || null, duration: t(formData, 'duration', 60) || null, cost: t(formData, 'cost', 80) || null,
    gi_bill_approved: formData.get('gi_bill_approved') === 'on', url: /^https:\/\//i.test(url) ? url : `https://${url.replace(/^https?:\/\//i, '')}`,
    status: formData.get('publish') === 'on' ? 'live' : 'draft',
  };
  if (fields.title.length < 4 || fields.description.length < 20) redirect('/employer/training?error=required');
  const { error } = await createClient().from('training_programs').insert(fields);
  if (error) redirect(`/employer/training?error=${error.code === 'P0012' ? 'domain' : error.code === 'P0011' ? 'listing' : 'save'}`);
  revalidatePath('/employer/training');
  redirect('/employer/training?saved=1');
}

export async function setProgramStatus(id: string, status: 'live' | 'draft') {
  const { user } = await requireRole(['employer'], '/employer/training');
  const companyId = await myCompanyId(user.id);
  const { error } = await createClient().from('training_programs').update({ status }).eq('id', id).eq('company_id', companyId);
  if (error) redirect(`/employer/training?error=${error.code === 'P0011' ? 'listing' : 'save'}`);
  revalidatePath('/employer/training');
}

export async function deleteProgram(id: string) {
  const { user } = await requireRole(['employer'], '/employer/training');
  const companyId = await myCompanyId(user.id);
  await createClient().from('training_programs').delete().eq('id', id).eq('company_id', companyId);
  revalidatePath('/employer/training');
}
