import type { Metadata } from 'next';
import Link from 'next/link';
import { allPublicJobs, filterPublicJobs, type PublicFilters } from '@/lib/publicJobs';
import { responseDays, responseLabel } from '@/lib/responsiveness';
import { ARRANGEMENT_LABELS, EMPLOYMENT_LABELS, formatSalary, postedAgo } from '@/lib/format';
import { CANONICAL_ORIGIN } from '@/lib/seo';
import { US_STATES } from '@/lib/states';

const PER_PAGE = 30;
const PAY = [['', 'Any pay'], ['50000', '$50K+'], ['75000', '$75K+'], ['100000', '$100K+'], ['125000', '$125K+'], ['150000', '$150K+']];

type Search = PublicFilters & { page?: string };
/** "Remote" typed on the home page means remote jobs; anything else is a state name or code. */
const where = (w?: string) => { const t = (w ?? '').trim().slice(0, 20); return /^(remote|anywhere|work from home|wfh)$/i.test(t) ? 'remote' : t || undefined; };
const pick = (sp: Search): PublicFilters => ({
  q: sp.q?.slice(0, 80) || undefined, where: where(sp.where), clearance: sp.clearance || undefined,
  pay: sp.pay || undefined, pcs: sp.pcs === '1' ? '1' : undefined,
});

export async function generateMetadata(props: { searchParams: Promise<Search> }): Promise<Metadata> {
  const filtered = Object.values(pick(await props.searchParams)).some(Boolean);
  return {
    title: 'Open jobs for veterans and service members',
    description: 'Jobs from employers verified by LanceNest, hiring verified service members, veterans and military spouses. Apply with your verified LanceNest profile.',
    alternates: { canonical: `${CANONICAL_ORIGIN}/open-jobs` },
    // Filtered views are for people, not search engines: the main list and each job page are what Google indexes.
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function OpenJobsPage(props: { searchParams: Promise<Search> }) {
  const sp = await props.searchParams;
  const filters = pick(sp);
  const filtered = Object.values(filters).some(Boolean);
  const matches = filterPublicJobs(await allPublicJobs(), filters);
  const pages = Math.max(1, Math.ceil(matches.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1));
  const shown = matches.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const speed = await responseDays(shown.map((m) => m.companyId));
  const href = (p: number) => {
    const q = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) q.set(k, v); });
    if (p > 1) q.set('page', String(p));
    return `/open-jobs${q.toString() ? `?${q}` : ''}`;
  };

  return (
    <div className="container-page max-w-5xl py-12">
      <p className="eyebrow">Open jobs</p>
      <h1 className="mt-2 font-serif text-4xl font-medium leading-tight sm:text-5xl">Jobs from verified employers</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Every employer here was reviewed by LanceNest, and every job shows pay. Employer names, company pages and applications are for verified members.{' '}
        <Link href="/signup?role=veteran" className="text-navy underline decoration-brass/60 underline-offset-4">Create a free profile</Link> to see them and apply.
      </p>

      <form action="/open-jobs" method="get" className="card mt-8 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_0.9fr_auto]">
        <div><label htmlFor="oj-q" className="field-label">Job title or keyword</label><input id="oj-q" name="q" defaultValue={filters.q} maxLength={80} placeholder="e.g. logistics, cyber, 25B" className="field" /></div>
        <div>
          <label htmlFor="oj-where" className="field-label">Where</label>
          <select id="oj-where" name="where" defaultValue={filters.where ?? ''} className="field">
            <option value="">Anywhere</option><option value="remote">Remote only</option>
            {US_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="oj-clr" className="field-label">Clearance</label>
          <select id="oj-clr" name="clearance" defaultValue={filters.clearance ?? ''} className="field">
            <option value="">Any</option><option value="required">Clearance required</option><option value="none">No clearance needed</option>
          </select>
        </div>
        <div>
          <label htmlFor="oj-pay" className="field-label">Pay</label>
          <select id="oj-pay" name="pay" defaultValue={filters.pay ?? ''} className="field">{PAY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
        <div className="flex items-end gap-2"><button type="submit" className="btn btn-primary w-full">Search</button></div>
        <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2 lg:col-span-5">
          <input type="checkbox" name="pcs" value="1" defaultChecked={filters.pcs === '1'} className="h-4 w-4 accent-navy" />
          Keeps through a PCS move (remote, or hiring in several locations)
          {filtered && <Link href="/open-jobs" className="ml-auto text-navy underline decoration-brass underline-offset-4">Clear</Link>}
        </label>
      </form>

      <p className="mt-6 text-sm text-muted" aria-live="polite">{matches.length.toLocaleString()} {matches.length === 1 ? 'job' : 'jobs'}{filters.q ? <> for “{filters.q}”</> : null}</p>

      {shown.length === 0 ? (
        <div className="card mt-4 p-8 text-center">
          <p className="font-semibold text-ink">{filtered ? 'No public jobs match that search yet.' : 'New jobs are on the way.'}</p>
          <p className="mt-2 text-sm text-muted">Verified members see every job, including ones employers keep off this public list.</p>
          <Link href="/signup?role=veteran" className="btn btn-primary mt-5">Create a free profile</Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-4">
          {shown.map(({ job, companyId }) => {
            const salary = formatSalary(job.salary_min, job.salary_max, job.salary_period);
            const fast = responseLabel(speed.get(companyId));
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
                    {fast && <span className="pill border-olive/40 bg-olive/10 text-olive">{fast}</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav className="mt-10 flex items-center justify-between text-sm" aria-label="Pages">
          {page > 1 ? <Link href={href(page - 1)} className="btn btn-outline">← Newer</Link> : <span />}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link href={href(page + 1)} className="btn btn-outline">Older →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
