'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyMember } from '@/lib/email';

async function requireVeteran(slug: string) {
  const session = await getSessionProfile();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/jobs/${slug}`)}`);
  if (!['veteran', 'admin'].includes(session.profile?.role ?? '')) redirect(`/jobs/${slug}`);
  return session.user.id;
}

export async function toggleSaveJob(jobId: string, slug: string) {
  const userId = await requireVeteran(slug);
  const supabase = await createClient();
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
  const supabase = await createClient();
  const resumeId = String(formData.get('resume_id') ?? '') || null;
  // Easy Apply: every screening question the employer added must be answered.
  const { data: job } = await supabase.from('jobs').select('screening_questions, apply_mode').eq('id', jobId).maybeSingle();
  if (job?.apply_mode === 'external') redirect(`/jobs/${slug}`); // this employer takes applications on its own site only
  const questions = ((job?.screening_questions as { q: string; type: string }[] | null) ?? []).slice(0, 5);
  const answers = questions.map((q, i) => ({ q: q.q, a: String(formData.get(`answer_${i}`) ?? '').trim().slice(0, 1000) }));
  if (answers.some((x) => !x.a)) redirect(`/jobs/${slug}?apply=answers`);
  const { data: existing } = await supabase.from('applications').select('id, status, source').eq('profile_id', userId).eq('job_id', jobId).maybeSingle();
  let error: { message: string } | null = null;
  if (!existing) {
    ({ error } = await supabase.from('applications').insert({ profile_id: userId, job_id: jobId, resume_id: resumeId, source: 'lancenest', answers }));
  } else if (existing.status === 'withdrawn' || existing.source === 'external') {
    // Applying again after withdrawing, or Easy Apply after opening the company's own application:
    // turn the record into a real LanceNest application (résumé and answers included) and tell the employer.
    error = await reapply(existing.id as string, userId, jobId, resumeId, answers);
  }
  if (error) { console.error('apply failed:', error.message); redirect(`/jobs/${slug}?apply=error`); }
  revalidatePath(`/jobs/${slug}`);
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/applications');
  redirect(`/jobs/${slug}?apply=done`);
}

/** Members (verified, like any application) re-applying through Easy Apply. Their own record only. */
async function reapply(id: string, userId: string, jobId: string, resumeId: string | null, answers: { q: string; a: string }[]) {
  const admin = createAdminClient();
  const [{ data: who }, { data: vet }, { data: resume }] = await Promise.all([
    admin.from('profiles').select('role, full_name').eq('id', userId).maybeSingle(),
    admin.from('veteran_profiles').select('verification_status').eq('profile_id', userId).maybeSingle(),
    resumeId ? admin.from('resumes').select('id').eq('id', resumeId).eq('profile_id', userId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (who?.role !== 'admin' && vet?.verification_status !== 'verified') return { message: 'not verified' };
  const { error } = await admin.from('applications')
    .update({ source: 'lancenest', status: 'applied', resume_id: resume ? resumeId : null, answers, applied_at: new Date().toISOString() })
    .eq('id', id).eq('profile_id', userId);
  if (error) return error;
  const { data: job } = await admin.from('jobs').select('title, company:companies(owner_id)').eq('id', jobId).maybeSingle();
  const owner = (job?.company as unknown as { owner_id: string } | null)?.owner_id;
  if (owner) await notifyMember(owner, { type: 'application', title: `${who?.full_name || 'A member'} applied to ${job?.title}`, link: `/employer/jobs/${jobId}/applicants` });
  return null;
}

/** After "Apply on company site": the member tells us whether they finished applying there (like LinkedIn's "Did you apply?"). */
export async function confirmSiteApply(jobId: string, slug: string, applied: boolean) {
  const userId = await requireVeteran(slug);
  const supabase = await createClient();
  const { data: existing } = await supabase.from('applications').select('id, status, source').eq('profile_id', userId).eq('job_id', jobId).maybeSingle();
  if (applied) {
    if (!existing) await supabase.from('applications').insert({ profile_id: userId, job_id: jobId, source: 'external' });
    else if (existing.source === 'external' && existing.status === 'withdrawn') await supabase.from('applications').update({ status: 'applied' }).eq('id', existing.id);
  } else if (existing?.source === 'external' && existing.status === 'applied') {
    await supabase.from('applications').update({ status: 'withdrawn' }).eq('id', existing.id);
  }
  revalidatePath(`/jobs/${slug}`);
  revalidatePath('/dashboard/applications');
}
