'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function createAlert(formData: FormData) {
  const { user } = await requireRole(['veteran'], '/dashboard/alerts');
  const arrangement = String(formData.get('arrangement') ?? '');
  const { error } = await createClient().from('job_alerts').insert({
    profile_id: user.id, keywords: String(formData.get('keywords') ?? '').trim().slice(0, 120) || null,
    state: String(formData.get('state') ?? '').slice(0, 5) || null, arrangement: ['remote', 'hybrid', 'onsite'].includes(arrangement) ? arrangement : null,
    cleared_only: formData.get('cleared_only') === 'on',
  });
  redirect(`/dashboard/alerts?${error ? `error=${error.code === 'P0014' ? 'limit' : 'plan'}` : 'saved=1'}`);
}

export async function deleteAlert(id: string) {
  const { user } = await requireRole(['veteran'], '/dashboard/alerts');
  await createClient().from('job_alerts').delete().eq('id', id).eq('profile_id', user.id);
  revalidatePath('/dashboard/alerts');
}
