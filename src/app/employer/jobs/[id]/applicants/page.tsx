import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PAID, getMyCompany } from '@/lib/employer';
import Avatar from '@/components/network/Avatar';
import SubmitButton from '@/components/SubmitButton';
import { startConversation } from '@/app/messages/actions';

export const metadata: Metadata = { title: 'Applicants' };

const STAGES = [['viewed', 'Reviewing'], ['interview', 'Interview'], ['offer', 'Offer'], ['rejected', 'Not selected']] as const;

async function moveApplicant(applicationId: string, jobId: string, formData: FormData) {
  'use server';
  await requireRole(['employer'], '/employer/dashboard');
  const status = String(formData.get('status') ?? '');
  if (!STAGES.some(([s]) => s === status)) return;
  // Row-level security: only the hiring company can update; the applicant is notified by a database trigger.
  await createClient().from('applications').update({ status }).eq('id', applicationId).eq('job_id', jobId);
  revalidatePath(`/employer/jobs/${jobId}/applicants`);
}

type App = { id: string; status: string; applied_at: string; profile_id: string; profile: { full_name: string; username: string | null; headline: string | null; service_summary: string | null; verified: boolean } | null };

export default async function ApplicantsPage({ params }: { params: { id: string } }) {
  const { user } = await requireRole(['employer'], '/employer/dashboard');
  const company = await getMyCompany(user.id);
  const supabase = createClient();
  const { data: job } = await supabase.from('jobs').select('id, title, company_id').eq('id', params.id).maybeSingle();
  if (!job || !company || job.company_id !== company.id) notFound();

  // Opening the pipeline marks new applications as "Reviewing" (the applicant is told their application was viewed).
  await supabase.from('applications').update({ status: 'viewed' }).eq('job_id', job.id).eq('status', 'applied');
  const { data } = await supabase.from('applications')
    .select('id, status, applied_at, profile_id, profile:profiles!applications_profile_id_fkey(full_name, username, headline, service_summary, verified)')
    .eq('job_id', job.id).neq('status', 'withdrawn').order('applied_at', { ascending: false });
  const apps = (data ?? []) as unknown as App[];

  return (
    <div className="container-page max-w-4xl py-10">
      <Link href={`/employer/jobs/${job.id}`} className="text-sm text-muted hover:text-navy">← {job.title}</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-4xl font-medium">Applicants ({apps.length})</h1>
        {PAID.includes(company.plan) ? (
          <a href={`/api/employer/applicants?job=${job.id}`} className="btn btn-outline">Export CSV</a>
        ) : (
          <Link href="/employers" className="text-sm text-muted underline">CSV export · Professional</Link>
        )}
      </div>
      {apps.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-muted">No applicants yet. Boosting the job puts it at the top of search.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {apps.map((a) => (
            <li key={a.id} className="card flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
              <Avatar name={a.profile?.full_name} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {a.profile?.username ? <Link href={`/veterans/${a.profile.username}`} className="hover:underline">{a.profile.full_name}</Link> : a.profile?.full_name ?? 'Applicant'}
                  {a.profile?.verified && <span className="ml-1.5 text-brass-dark">✦</span>}
                </p>
                <p className="truncate text-sm text-muted">{[a.profile?.headline, a.profile?.service_summary].filter(Boolean).join(' · ')}</p>
                <p className="text-xs text-muted">Applied {new Date(a.applied_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}</p>
              </div>
              <form action={moveApplicant.bind(null, a.id, job.id)} className="flex gap-2">
                <select name="status" defaultValue={a.status === 'applied' ? 'viewed' : a.status} className="field py-2 text-sm">
                  {STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <SubmitButton className="btn btn-outline py-2" pendingText="…">Update</SubmitButton>
              </form>
              <form action={startConversation.bind(null, a.profile_id)}>
                <SubmitButton className="btn btn-primary py-2" pendingText="…">Message</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
