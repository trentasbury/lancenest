import Link from 'next/link';
import type { JobWithCompany } from '@/lib/types';
import { ARRANGEMENT_LABELS, CLEARANCE_LABELS, EMPLOYMENT_LABELS, formatSalary, postedAgo } from '@/lib/format';
import CompanyMark from './CompanyMark';

export default function JobCard({ job, early }: { job: JobWithCompany; early?: boolean }) {
  const salary = formatSalary(job.salary_min, job.salary_max, job.salary_period);
  const companyName = job.company?.name ?? 'Company';

  return (
    <Link
      href={`/jobs/${job.slug}`}
      className="card card-hover group flex gap-4 p-5 sm:p-6"
    >
      <CompanyMark name={companyName} logoUrl={job.company?.logo_url} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <h3 className="font-sans text-[17px] font-semibold leading-snug text-navy group-hover:underline group-hover:decoration-brass/60 group-hover:underline-offset-4">{job.title}</h3>
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
          {early && <span className="pill border-brass/60 bg-brass/10 text-brass-dark">Be an early applicant</span>}
          {job.employment_type === 'skillbridge' && <span className="pill border-olive/50 bg-olive/10 text-olive">DoD SkillBridge · keep military pay</span>}
          {job.veteran_preferred && <span className="pill border-brass/50 bg-brass/10 text-brass-dark">Veteran preferred</span>}
          {job.clearance_required !== 'none' && (
            <span className="pill border-navy/30 bg-navy/5 text-navy">{CLEARANCE_LABELS[job.clearance_required]}{(job as unknown as { polygraph_required?: string }).polygraph_required === 'full_scope' ? ' w/ Full-Scope Poly' : (job as unknown as { polygraph_required?: string }).polygraph_required === 'ci' ? ' w/ CI Poly' : ''} clearance</span>
          )}
          {job.employment_type === 'skillbridge' && (
            <span className="pill border-olive/40 bg-olive/10 text-olive">For service members</span>
          )}
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span>{postedAgo(job.posted_at)}</span>
          {(job.apply_mode ?? (job.apply_url ? 'both' : 'easy')) === 'external'
            ? <span>· Apply on company site ↗</span>
            : <span className="font-semibold text-olive">· Easy Apply</span>}
        </p>
      </div>
    </Link>
  );
}
