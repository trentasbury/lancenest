import type { Metadata } from 'next';
import Link from 'next/link';
import JobCard from '@/components/JobCard';
import EmptyState from '@/components/EmptyState';
import { searchJobs, type JobFilters } from '@/lib/jobs';

export const metadata: Metadata = {
  title: 'Find Jobs',
  description: 'Search veteran-friendly jobs, SkillBridge opportunities, and clearance roles on LanceNest.',
};

const ARRANGEMENTS = [
  ['', 'Any arrangement'],
  ['remote', 'Remote'],
  ['hybrid', 'Hybrid'],
  ['onsite', 'On-site'],
];
const TYPES = [
  ['', 'Any type'],
  ['full_time', 'Full-time'],
  ['part_time', 'Part-time'],
  ['contract', 'Contract'],
  ['internship', 'Internship'],
  ['skillbridge', 'SkillBridge'],
];
const CLEARANCE = [
  ['', 'Any clearance'],
  ['required', 'Clearance required'],
  ['none', 'No clearance needed'],
];

export default async function JobsPage({ searchParams }: { searchParams: JobFilters }) {
  const jobs = await searchJobs(searchParams);
  const hasFilters = Object.values(searchParams).some(Boolean);

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page py-12">
          <p className="eyebrow text-brass">Find Jobs</p>
          <h1 className="mt-3 font-serif text-5xl font-medium text-ivory">Your next mission.</h1>
          <form action="/jobs" method="get" className="mt-8 grid gap-2 rounded-[6px] bg-ivory p-2 shadow-lift md:grid-cols-[1fr_220px_auto]">
            <label htmlFor="q" className="sr-only">Job title, keyword, or company</label>
            <input id="q" name="q" defaultValue={searchParams.q} placeholder="Job title, keyword, or company" className="rounded-[3px] px-4 py-3 text-ink outline-none" />
            <label htmlFor="location" className="sr-only">Location</label>
            <input id="location" name="location" defaultValue={searchParams.location} placeholder="Location" className="rounded-[3px] px-4 py-3 text-ink outline-none md:border-l md:border-line" />
            {/* Preserve filters when searching again */}
            {searchParams.arrangement && <input type="hidden" name="arrangement" value={searchParams.arrangement} />}
            {searchParams.type && <input type="hidden" name="type" value={searchParams.type} />}
            {searchParams.clearance && <input type="hidden" name="clearance" value={searchParams.clearance} />}
            {searchParams.veteran && <input type="hidden" name="veteran" value={searchParams.veteran} />}
            <button type="submit" className="btn btn-primary">Search</button>
          </form>
        </div>
      </section>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[260px_1fr]">
        <aside>
          <form action="/jobs" method="get" className="card space-y-5 p-5 lg:sticky lg:top-24">
            <p className="eyebrow">Filters</p>
            {searchParams.q && <input type="hidden" name="q" value={searchParams.q} />}
            {searchParams.location && <input type="hidden" name="location" value={searchParams.location} />}
            <div>
              <label htmlFor="arrangement" className="field-label">Work arrangement</label>
              <select id="arrangement" name="arrangement" defaultValue={searchParams.arrangement ?? ''} className="field">
                {ARRANGEMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="type" className="field-label">Employment type</label>
              <select id="type" name="type" defaultValue={searchParams.type ?? ''} className="field">
                {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="clearance" className="field-label">Clearance</label>
              <select id="clearance" name="clearance" defaultValue={searchParams.clearance ?? ''} className="field">
                {CLEARANCE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input type="checkbox" name="veteran" value="1" defaultChecked={searchParams.veteran === '1'} className="h-4 w-4 accent-navy" />
              Veteran preferred only
            </label>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary flex-1">Apply</button>
              {hasFilters && <Link href="/jobs" className="btn btn-outline">Clear</Link>}
            </div>
          </form>
        </aside>

        <section aria-live="polite">
          <p className="mb-4 text-sm text-muted">
            {jobs.length} {jobs.length === 1 ? 'position' : 'positions'}
            {searchParams.q && <> for “{searchParams.q}”</>}
          </p>
          {jobs.length === 0 ? (
            <EmptyState
              title="No positions match that search yet."
              body="Try a broader title, a different location, or clear your filters. New roles are posted every week."
              action={{ href: '/jobs', label: 'See all jobs' }}
            />
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => <JobCard key={job.id} job={job} />)}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
