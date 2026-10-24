'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function saveTransition(formData: FormData) {
  const { user } = await requireRole(['veteran'], '/transition');
  const date = String(formData.get('separation_date') ?? '');
  await (await createClient()).from('veteran_profiles').update({
    separation_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    open_to_transition_hiring: formData.get('open_to_transition_hiring') === 'on',
    skillbridge_interest: formData.get('skillbridge_interest') === 'on',
  }).eq('profile_id', user.id);
  // Leaving within a year (and verified)? Turn on the free transition Pro.
  const { grantTransitionPro } = await import('@/lib/transitionPro');
  const granted = await grantTransitionPro(user.id);
  revalidatePath('/transition');
  redirect(granted ? '/transition?saved=1&pro=1' : '/transition?saved=1');
}
