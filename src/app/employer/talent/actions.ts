'use server';

import { getMyCompany } from '@/lib/employer';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole, safeNextPath } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

async function companyId(userId: string) {
  const data = await getMyCompany(userId);
  if (!data) redirect('/employer/dashboard');
  return data.id;
}

/** Save a candidate to a named list (Professional and above; enforced by the database). */
export async function saveToPool(profileId: string, back: string, formData: FormData) {
  const { user } = await requireRole(['employer'], '/employer/talent');
  const list = String(formData.get('list') ?? '').trim().slice(0, 60) || 'Shortlist';
  const note = String(formData.get('note') ?? '').trim().slice(0, 1000) || null;
  const { error } = await (await createClient()).from('talent_pool_items').upsert({ company_id: await companyId(user.id), profile_id: profileId, list_name: list, note }, { onConflict: 'company_id,profile_id,list_name' });
  revalidatePath('/employer/talent');
  const dest = safeNextPath(back) ?? '/employer/talent'; // same-site paths only
  redirect(`${dest}${dest.includes('?') ? '&' : '?'}${error ? 'pool=upgrade' : 'pool=saved'}#notice`);
}

export async function removeFromPool(id: string) {
  const { user } = await requireRole(['employer'], '/employer/talent');
  await (await createClient()).from('talent_pool_items').delete().eq('id', id).eq('company_id', await companyId(user.id));
  revalidatePath('/employer/talent');
}
