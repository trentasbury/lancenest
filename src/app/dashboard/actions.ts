'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const BOOSTS_PER_MONTH = 2;

/** Career Accelerator / Federal: feature your profile at the top of employer searches for 7 days (2 per calendar month). */
export async function boostProfile() {
  const { user } = await requireRole(['veteran'], '/dashboard');
  const { data: vet } = await createClient().from('veteran_profiles').select('plan').eq('profile_id', user.id).maybeSingle();
  if (!['pro_plus', 'federal_pro'].includes(vet?.plan as string)) redirect('/plans');
  const admin = createAdminClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { count } = await admin.from('profile_boosts').select('id', { count: 'exact', head: true }).eq('profile_id', user.id).gte('created_at', monthStart);
  if ((count ?? 0) >= BOOSTS_PER_MONTH) redirect('/dashboard?boost=used');
  await admin.from('profile_boosts').insert({ profile_id: user.id });
  await admin.from('veteran_profiles').update({ boosted_until: new Date(Date.now() + 7 * 86400000).toISOString() }).eq('profile_id', user.id);
  revalidatePath('/dashboard');
  redirect('/dashboard?boost=on');
}
