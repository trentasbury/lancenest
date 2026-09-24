'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';

async function requireVeteran(slug: string) {
  const session = await getSessionProfile();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/jobs/${slug}`)}`);
  if (session.profile?.role !== 'veteran') redirect(`/jobs/${slug}`);
  return session.user.id;
}

export async function toggleSaveJob(jobId: string, slug: string) {
  const userId = await requireVeteran(slug);
  const supabase = createClient();
  const { data: existing } = await supabase
    .from('saved_jobs')
    .select('job_id')
    .eq('profile_id', userId)
    .eq('job_id', jobId)
    .maybeSingle();

  if (existing) {
    await supabase.from('saved_jobs').delete().eq('profile_id', userId).eq('job_id', jobId);
  } else {
    await supabase.from('saved_jobs').insert({ profile_id: userId, job_id: jobId });
  }
  revalidatePath(`/jobs/${slug}`);
  revalidatePath('/dashboard');
}

export async function applyToJob(jobId: string, slug: string) {
  const userId = await requireVeteran(slug);
  const supabase = createClient();
  const { data: existing } = await supabase
    .from('applications')
    .select('id, status')
    .eq('profile_id', userId)
    .eq('job_id', jobId)
    .maybeSingle();

  if (!existing) {
    await supabase.from('applications').insert({ profile_id: userId, job_id: jobId });
  } else if (existing.status === 'withdrawn') {
    await supabase.from('applications').update({ status: 'applied' }).eq('id', existing.id);
  }
  revalidatePath(`/jobs/${slug}`);
  revalidatePath('/dashboard');
}
