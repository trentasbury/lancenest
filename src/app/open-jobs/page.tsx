import type { Metadata } from 'next';
import Link from 'next/link';
import { listPublicJobs } from '@/lib/publicJobs';
import { ARRANGEMENT_LABELS, EMPLOYMENT_LABELS, formatSalary, postedAgo } from '@/lib/format';
import { CANONICAL_ORIGIN } from '@/lib/seo';

const PER_PAGE = 30;

export const metadata: Metadata = {
  title: 'Open jobs for veterans and service members',
  description: 'Jobs from employers verified by LanceNest, hiring verified service members, veterans and military spouses. Apply with your verified LanceNest profile.',
  alternates: { canonical: `${CANONICAL_ORIGIN}/open-jobs` },
};

export default async function OpenJobsPage(props: { searchParams: Promise<{ page?: string }> }) {
  const { page: raw } = await props.searchParams;
  const page = Math.min(500, Math.max(1, Number.parseInt(raw ?? '1', 10) || 1));
  const { jobs, total } = await listPublicJobs(page, PER_PAGE);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="container-page max-w-4xl py-12">
      <p className="eyebrow">Open jobs</p>
      <h1 className="mt-2 font-serif text-4xl font-medium leading-tight sm:text-5xl">Jobs from verified employers</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Every employer here was reviewed by LanceNest. Employer names, company pages and applications are for verified members.{' '}
        <Link href="/signup?role=veteran" className="text-navy underline decoration-brass/60 underline-offset-4">Create a free profile</Link> to see them and apply.
      </p>

      {jobs.length === 0 ? (
        <div className="card mt-10 p-8 text-center">
          <p className="font-semibold text-ink">New jobs are on the way.</p>
          <p className="mt-2 text-sm text-muted">Verified members see every job, including ones employers keep off this public list.</p>
          <Link href="/signup?role=veteran" className="btn btn-primary mt-5">Create a free profile</Link>
        </div>
      ) : (
        <ul className="mt-10 space-y-4">
          {jobs.map((job) => {
            const salary = formatSalary(job.salary_min, job.salary_max, job.salary_period);
            return (
              <li key={job.slug}>
                <Link href={`/open-jobs/${job.slug}`} className="card card-hover group block p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <h2 className="font-sans text-[17px] font-semibold leading-snug text-navy group-hover:underline group-hover:decoration-brass/60 group-hover:underline-offset-4">{job.title}</h2>
                    {salary && <span className="whitespace-nowrap text-sm font-semibold text-navy">{salary}</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted">Verified employer{job.location && <> · {job.location}</>} · {postedAgo(job.posted_at)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="pill">{ARRANGEMENT_LABELS[job.work_arrangement]}</span>
                    <span className="pill">{EMPLOYMENT_LABELS[job.employment_type]}</span>
                    {job.clearance_required !== 'none' && <span className="pill border-navy/30 bg-navy/5 text-navy">Clearance required</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav className="mt-10 flex items-center justify-between text-sm" aria-label="Pages">
          {page > 1 ? <Link href={`/open-jobs?page=${page - 1}`} className="btn btn-outline">← Newer</Link> : <span />}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link href={`/open-jobs?page=${page + 1}`} className="btn btn-outline">Older →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
