import Link from 'next/link';
import type { JobWithCompany } from '@/lib/types';
import { ARRANGEMENT_LABELS, CLEARANCE_LABELS, EMPLOYMENT_LABELS, formatSalary, postedAgo } from '@/lib/format';
import CompanyMark from './CompanyMark';

export default function JobCard({ job }: { job: JobWithCompany }) {
  const salary = formatSalary(job.salary_min, job.salary_max, job.salary_period);
  const companyName = job.company?.name ?? 'Company';

  return (
    <Link
      href={`/jobs/${job.slug}`}
      className="card group flex gap-4 p-5 transition-all hover:-translate-y-0.5 hover:border-brass/60 sm:p-6"
    >
      <CompanyMark name={companyName} logoUrl={job.company?.logo_url} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <h3 className="font-serif text-xl font-semibold leading-tight text-ink group-hover:text-navy">{job.title}</h3>
          {salary && <span className="whitespace-nowrap text-sm font-semibold text-navy">{salary}</span>}
        </div>
        <p className="mt-1 text-sm text-muted">
          {companyName}
          {job.company?.is_verified && <span className="ml-2 rounded-full border border-olive/40 bg-olive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-olive">✓ Verified company</span>}
          {job.location && <> · {job.location}</>}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="pill">{ARRANGEMENT_LABELS[job.work_arrangement]}</span>
          <span className="pill">{EMPLOYMENT_LABELS[job.employment_type]}</span>
          {job.featured_until && new Date(job.featured_until) > new Date() && <span className="pill border-brass bg-brass text-navy-deep">Featured</span>}
          {job.veteran_preferred && <span className="pill border-brass/50 bg-brass/10 text-brass-dark">Veteran preferred</span>}
          {job.clearance_required !== 'none' && (
            <span className="pill border-navy/30 bg-navy/5 text-navy">{CLEARANCE_LABELS[job.clearance_required]} clearance</span>
          )}
          {job.employment_type === 'skillbridge' && (
            <span className="pill border-olive/40 bg-olive/10 text-olive">For service members</span>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">{postedAgo(job.posted_at)}</p>
      </div>
    </Link>
  );
}
