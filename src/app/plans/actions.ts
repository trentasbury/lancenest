'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function joinWaitlist(plan: 'veteran_pro' | 'veteran_federal_pro') {
  const session = await getSessionProfile();
  if (!session) redirect('/login?next=/plans');
  if (session.profile?.role !== 'veteran') redirect('/plans');
  const supabase = createClient();
  await supabase.from('plan_waitlist').upsert({ profile_id: session.user.id, plan }, { ignoreDuplicates: true });
  revalidatePath('/plans');
}
