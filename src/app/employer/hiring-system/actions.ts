'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { getMyCompany } from '@/lib/employer';
import { createAdminClient } from '@/lib/supabase/admin';
import { SECRET_BOX_READY, seal } from '@/lib/secretBox';
import { sendApplicationToAts } from '@/lib/atsPush';

const PROVIDERS = ['greenhouse', 'lever', 'ashby'] as const;

/** Owner only: connect Greenhouse, Lever or Ashby. The API key is encrypted before it's stored and never shown again. */
export async function saveConnection(formData: FormData) {
  const { user } = await requireRole(['employer'], '/employer/hiring-system');
  const company = await getMyCompany(user.id);
  if (!company?.isOwner || !company.is_verified) redirect('/employer/hiring-system?error=owner');
  if (!SECRET_BOX_READY()) redirect('/employer/hiring-system?error=off');
  const provider = String(formData.get('provider') ?? '') as (typeof PROVIDERS)[number];
  const board = String(formData.get('board') ?? '').trim();
  const key = String(formData.get('api_key') ?? '').trim();
  if (!PROVIDERS.includes(provider)) redirect('/employer/hiring-system?error=provider');
  if (provider !== 'ashby' && !/^[A-Za-z0-9_-]{1,80}$/.test(board)) redirect('/employer/hiring-system?error=board');
  if (key.length < 8 || key.length > 300 || /\s/.test(key)) redirect('/employer/hiring-system?error=key');
  await createAdminClient().from('ats_connections').upsert({
    company_id: company.id, provider, board: provider === 'ashby' ? null : board, api_key_enc: seal(key), key_hint: key.slice(-4),
    auto_send: formData.get('auto_send') === 'on', last_error: null, created_by: user.id, updated_at: new Date().toISOString(),
  });
  revalidatePath('/employer/hiring-system');
  redirect('/employer/hiring-system?saved=1');
}

export async function setAutoSend(on: boolean) {
  const { user } = await requireRole(['employer'], '/employer/hiring-system');
  const company = await getMyCompany(user.id);
  if (!company?.isOwner) redirect('/employer/hiring-system?error=owner');
  await createAdminClient().from('ats_connections').update({ auto_send: on, updated_at: new Date().toISOString() }).eq('company_id', company.id);
  revalidatePath('/employer/hiring-system');
}

export async function disconnect() {
  const { user } = await requireRole(['employer'], '/employer/hiring-system');
  const company = await getMyCompany(user.id);
  if (!company?.isOwner) redirect('/employer/hiring-system?error=owner');
  await createAdminClient().from('ats_connections').delete().eq('company_id', company.id);
  revalidatePath('/employer/hiring-system');
  redirect('/employer/hiring-system?removed=1');
}

/** Any member of the hiring team: send one applicant across now. */
export async function sendApplicant(applicationId: string, jobId: string) {
  const { user } = await requireRole(['employer'], '/employer/dashboard');
  const company = await getMyCompany(user.id);
  if (!company) redirect('/employer/dashboard');
  const { data: app } = await createAdminClient().from('applications').select('id, job:jobs!inner(id, company_id)').eq('id', applicationId).eq('job_id', jobId).maybeSingle();
  if ((app as unknown as { job: { company_id: string } } | null)?.job.company_id !== company.id) redirect('/employer/dashboard');
  await sendApplicationToAts(applicationId);
  revalidatePath(`/employer/jobs/${jobId}/applicants`);
}
