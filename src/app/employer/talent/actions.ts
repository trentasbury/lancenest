'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

async function companyId(userId: string) {
  const { data } = await createClient().from('companies').select('id').eq('owner_id', userId).maybeSingle();
  if (!data) redirect('/employer/dashboard');
  return data.id as string;
}

/** Save a candidate to a named list (Professional and above; enforced by the database). */
export async function saveToPool(profileId: string, back: string, formData: FormData) {
  const { user } = await requireRole(['employer'], '/employer/talent');
  const list = String(formData.get('list') ?? '').trim().slice(0, 60) || 'Shortlist';
  const note = String(formData.get('note') ?? '').trim().slice(0, 1000) || null;
  const { error } = await createClient().from('talent_pool_items').upsert({ company_id: await companyId(user.id), profile_id: profileId, list_name: list, note }, { onConflict: 'company_id,profile_id,list_name' });
  revalidatePath('/employer/talent');
  redirect(`${back}${back.includes('?') ? '&' : '?'}${error ? 'pool=upgrade' : 'pool=saved'}`);
}

export async function removeFromPool(id: string) {
  const { user } = await requireRole(['employer'], '/employer/talent');
  await createClient().from('talent_pool_items').delete().eq('id', id).eq('company_id', await companyId(user.id));
  revalidatePath('/employer/talent');
}
