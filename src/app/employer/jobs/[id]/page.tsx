import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import JobForm from '@/components/employer/JobForm';
import JobErrors from '@/components/employer/JobErrors';
import SubmitButton from '@/components/SubmitButton';
import type { Job } from '@/lib/types';
import { saveJob, setJobStatus } from '../actions';

export const metadata: Metadata = { title: 'Manage job' };

export default async function ManageJobPage({ params, searchParams }: { params: { id: string }; searchParams: { error?: string; saved?: string } }) {
  await requireRole(['employer'], '/employer/dashboard');
  const supabase = createClient();
  // Row-level security only returns this job to its own company (or if it's open).
  const { data } = await supabase.from('jobs').select('*, company:companies!inner(owner_id)').eq('id', params.id).maybeSingle();
  const { data: { user } } = await supabase.auth.getUser();
  if (!data || (data.company as { owner_id: string }).owner_id !== user?.id) notFound();
  const job = data as unknown as Job & { featured_until: string | null };
  const featured = job.featured_until && new Date(job.featured_until) > new Date();
  const { count: applicants } = await supabase.from('applications').select('id', { count: 'exact', head: true }).eq('job_id', job.id).neq('status', 'withdrawn');

  const statusButtons: [string, 'open' | 'paused' | 'closed' | 'draft'][] =
    job.status === 'open' ? [['Pause', 'paused'], ['Close', 'closed']]
    : job.status === 'paused' ? [['Reopen', 'open'], ['Close', 'closed']]
    : job.status === 'closed' ? [['Reopen', 'open']]
    : [['Publish', 'open']];

  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <Link href="/employer/dashboard" className="text-sm text-muted hover:text-navy">← Employer dashboard</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl font-medium">{job.title}</h1>
          <p className="mt-1 text-sm text-muted">
            <span className="pill capitalize">{job.status}</span>
            {featured && <span className="pill ml-2 border-brass bg-brass/10 text-brass-dark">Featured until {new Date(job.featured_until!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
            <span className="ml-2">{applicants ?? 0} applicant{applicants === 1 ? '' : 's'}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {job.status === 'open' && <Link href={`/jobs/${job.slug}`} className="btn btn-ghost border border-line">View listing</Link>}
          {statusButtons.map(([label, s]) => (
            <form key={s} action={setJobStatus.bind(null, job.id, s)}><SubmitButton className="btn btn-outline" pendingText="…">{label}</SubmitButton></form>
          ))}
        </div>
      </div>

      {job.status === 'open' && (
        <div className="card flex flex-col gap-3 border-brass/50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{featured ? 'Extend the boost' : 'Boost this job'}</p>
            <p className="text-sm text-muted">Featured at the top of job search for 30 days{featured ? ' — added to your current boost' : ''}.</p>
          </div>
          <form action="/api/billing/checkout" method="post">
            <input type="hidden" name="product" value="job_boost" />
            <input type="hidden" name="job_id" value={job.id} />
            <button className="btn btn-brass shrink-0">Boost · $49</button>
          </form>
        </div>
      )}

      <JobErrors error={searchParams.error} saved={searchParams.saved} />
      <JobForm job={job} action={saveJob.bind(null, job.id)} />
    </div>
  );
}
