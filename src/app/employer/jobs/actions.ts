'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import { BOOST_DAYS } from '@/lib/stripe';

const t = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? '').trim().slice(0, max);
const oneOf = (v: string, allowed: string[], fallback: string) => (allowed.includes(v) ? v : fallback);
const money = (v: string) => {
  const n = Math.round(Number(v.replace(/[$,\s]/g, '')));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Create (jobId = null) or update a job. Ownership is enforced by row-level security. */
export async function saveJob(jobId: string | null, formData: FormData) {
  const { user } = await requireRole(['employer'], '/employer/dashboard');
  const supabase = createClient();
  const { data: company } = await supabase.from('companies').select('id').eq('owner_id', user.id).maybeSingle();
  if (!company) redirect('/employer/dashboard');

  const title = t(formData, 'title', 140);
  const description = t(formData, 'description', 8000);
  const back = jobId ? `/employer/jobs/${jobId}` : '/employer/jobs/new';
  if (!title || !description) redirect(`${back}?error=required`);

  const salaryMin = money(t(formData, 'salary_min', 12));
  const salaryMax = money(t(formData, 'salary_max', 12));
  if (salaryMin && salaryMax && salaryMax < salaryMin) redirect(`${back}?error=salary`);
  const location = t(formData, 'location', 120);

  const fields = {
    title,
    department: t(formData, 'department', 120) || null,
    location: location || null,
    work_arrangement: oneOf(t(formData, 'work_arrangement', 10), ['remote', 'hybrid', 'onsite'], 'onsite'),
    employment_type: oneOf(t(formData, 'employment_type', 12), ['full_time', 'part_time', 'contract', 'internship', 'skillbridge'], 'full_time'),
    experience_level: oneOf(t(formData, 'experience_level', 10), ['entry', 'mid', 'senior', 'executive'], 'mid'),
    industry: t(formData, 'industry', 80) || null,
    salary_min: salaryMin,
    salary_max: salaryMax,
    salary_period: oneOf(t(formData, 'salary_period', 5), ['year', 'hour'], 'year'),
    description,
    responsibilities: t(formData, 'responsibilities', 4000) || null,
    qualifications: t(formData, 'qualifications', 4000) || null,
    preferred_qualifications: t(formData, 'preferred_qualifications', 4000) || null,
    benefits: t(formData, 'benefits', 2000) || null,
    veteran_preferred: formData.get('veteran_preferred') === 'on',
    military_transferable: formData.get('military_transferable') === 'on',
    clearance_required: oneOf(t(formData, 'clearance_required', 14), ['none', 'public_trust', 'confidential', 'secret', 'top_secret', 'ts_sci'], 'none'),
    clearance_eligible: formData.get('clearance_eligible') === 'on',
    status: oneOf(t(formData, 'status', 8), ['draft', 'open'], 'open'),
  };

  let id = jobId;
  let error;
  if (jobId) {
    ({ error } = await supabase.from('jobs').update(fields).eq('id', jobId).eq('company_id', company.id));
  } else {
    const slug = `${slugify(`${title} ${location}`)}-${Math.random().toString(36).slice(2, 7)}`;
    const res = await supabase.from('jobs').insert({ ...fields, company_id: company.id, slug }).select('id').single();
    error = res.error;
    id = res.data?.id ?? null;
  }
  if (error) {
    if (error.code === 'P0003') redirect(`${back}?error=limit`);
    console.error('saveJob failed:', error.message);
    redirect(`${back}?error=save`);
  }
  revalidatePath('/employer/dashboard');
  revalidatePath('/jobs');
  redirect(`/employer/jobs/${id}?saved=1`);
}

export async function setJobStatus(jobId: string, status: 'open' | 'paused' | 'closed' | 'draft') {
  await requireRole(['employer'], '/employer/dashboard');
  const { error } = await createClient().from('jobs').update({ status }).eq('id', jobId);
  if (error?.code === 'P0003') redirect(`/employer/jobs/${jobId}?error=limit`);
  revalidatePath('/employer/dashboard');
  revalidatePath('/jobs');
  redirect(`/employer/jobs/${jobId}?saved=1`);
}

const INCLUDED_FEATURES: Record<string, number> = { professional: 2, federal: Infinity, enterprise: Infinity };

/** Uses a featured-job credit included in the company's paid plan. */
export async function featureWithPlan(jobId: string) {
  const { user } = await requireRole(['employer'], '/employer/dashboard');
  const supabase = createClient();
  const { data: company } = await supabase.from('companies').select('id, plan').eq('owner_id', user.id).maybeSingle();
  const allowance = company ? INCLUDED_FEATURES[company.plan as string] ?? 0 : 0;
  if (!company || !allowance) redirect(`/employer/jobs/${jobId}?error=plan`);
  const { data: job } = await supabase.from('jobs').select('id, featured_until').eq('id', jobId).eq('company_id', company.id).eq('status', 'open').maybeSingle();
  if (!job) redirect(`/employer/jobs/${jobId}?error=save`);

  const admin = createAdminClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { count } = await admin.from('purchases').select('id', { count: 'exact', head: true })
    .eq('company_id', company.id).eq('kind', 'job_boost').eq('amount_cents', 0).gte('created_at', monthStart);
  if ((count ?? 0) >= allowance) redirect(`/employer/jobs/${jobId}?error=allowance`);

  const base = job.featured_until && new Date(job.featured_until) > new Date() ? new Date(job.featured_until) : new Date();
  base.setDate(base.getDate() + BOOST_DAYS);
  await admin.from('jobs').update({ featured_until: base.toISOString() }).eq('id', jobId);
  await admin.from('purchases').insert({ company_id: company.id, kind: 'job_boost', job_id: jobId, amount_cents: 0, stripe_checkout_session_id: `included:${crypto.randomUUID()}` });
  revalidatePath('/jobs');
  redirect(`/employer/jobs/${jobId}?saved=1`);
}
