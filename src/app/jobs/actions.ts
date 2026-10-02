'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';

async function requireVeteran(slug: string) {
  const session = await getSessionProfile();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/jobs/${slug}`)}`);
  if (!['veteran', 'admin'].includes(session.profile?.role ?? '')) redirect(`/jobs/${slug}`);
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

export async function applyToJob(jobId: string, slug: string, formData: FormData) {
  const userId = await requireVeteran(slug);
  const supabase = createClient();
  const resumeId = String(formData.get('resume_id') ?? '') || null;
  // Easy Apply: every screening question the employer added must be answered.
  const { data: job } = await supabase.from('jobs').select('screening_questions').eq('id', jobId).maybeSingle();
  const questions = ((job?.screening_questions as { q: string; type: string }[] | null) ?? []).slice(0, 5);
  const answers = questions.map((q, i) => ({ q: q.q, a: String(formData.get(`answer_${i}`) ?? '').trim().slice(0, 1000) }));
  if (answers.some((x) => !x.a)) redirect(`/jobs/${slug}?apply=answers`);
  const { data: existing } = await supabase.from('applications').select('id, status').eq('profile_id', userId).eq('job_id', jobId).maybeSingle();
  let error: { message: string } | null = null;
  if (!existing) {
    ({ error } = await supabase.from('applications').insert({ profile_id: userId, job_id: jobId, resume_id: resumeId, source: 'lancenest', answers }));
  } else if (existing.status === 'withdrawn') {
    ({ error } = await supabase.from('applications').update({ status: 'applied' }).eq('id', existing.id));
  }
  if (error) { console.error('apply failed:', error.message); redirect(`/jobs/${slug}?apply=error`); }
  revalidatePath(`/jobs/${slug}`);
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/applications');
  redirect(`/jobs/${slug}?apply=done`);
}
