import type { Metadata } from 'next';
import Link from 'next/link';
import RecommendedJobs from '@/components/RecommendedJobs';
import { createClient } from '@/lib/supabase/server';
import { US_STATES } from '@/lib/states';
import JobCard from '@/components/JobCard';
import EmptyState from '@/components/EmptyState';
import { getFeaturedJobs, searchJobs, type JobFilters } from '@/lib/jobs';
import { ARRANGEMENTS, parseArrangements, stateOf, type Arrangement } from '@/lib/place';
import { responseDays, responseLabel } from '@/lib/responsiveness';

export const metadata: Metadata = {
  title: 'Find Jobs',
  description: 'Search veteran-friendly jobs, SkillBridge opportunities, and clearance roles on LanceNest.',
};

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

/** "Remote jobs from anywhere, plus on-site jobs in Florida" — what the current place filter means. */
function placeSummary(stateName: string | null, arr: Arrangement[]) {
  if (!stateName) return null;
  const local = (arr.length ? arr : (['hybrid', 'onsite'] as Arrangement[])).filter((a) => a !== 'remote');
  const remote = !arr.length || arr.includes('remote');
  const names = local.map((a) => (a === 'onsite' ? 'on-site' : a));
  const parts = [remote && 'remote jobs from anywhere', names.length && `${names.join(' and ')} jobs in ${stateName}`].filter(Boolean) as string[];
  const text = parts.join(', plus ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default async function JobsPage(props: { searchParams: Promise<JobFilters> }) {
  const raw = await props.searchParams;
  // A state typed in a "Location" box (e.g. from the homepage) becomes the state filter.
  const typed = typeof raw.location === 'string' ? raw.location.trim() : '';
  const typedState = !raw.state && typed ? stateOf(typed) : null;
  const typedRemote = /^(remote|anywhere|work from home|wfh)$/i.test(typed);
  const searchParams: JobFilters = { ...raw, state: raw.state || typedState?.[0] || undefined, location: typedState || typedRemote ? undefined : raw.location,
    arrangement: typedRemote && !raw.arrangement ? 'remote' : raw.arrangement };
  const arrangements = parseArrangements(searchParams.arrangement);
  const stateName = searchParams.state && searchParams.state !== 'multi' ? stateOf(searchParams.state)?.[1] ?? null : null;
  const place = placeSummary(stateName, arrangements);
  // Links that change one filter and keep the rest.
  const hrefWith = (change: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | undefined> = { q: searchParams.q, location: searchParams.location, state: searchParams.state, arrangement: arrangements.join(',') || undefined,
      type: searchParams.type, clearance: searchParams.clearance, poly: searchParams.poly, veteran: searchParams.veteran, pcs: searchParams.pcs, employer: searchParams.employer };
    Object.entries({ ...base, ...change }).forEach(([k, v]) => { if (v) p.set(k, v); });
    return `/jobs${p.toString() ? `?${p}` : ''}`;
  };
  const toggle = (v: Arrangement) => hrefWith({ arrangement: (arrangements.includes(v) ? arrangements.filter((a) => a !== v) : [...arrangements, v]).join(',') || null });

  const [jobs, featured] = await Promise.all([searchJobs(searchParams), getFeaturedJobs()]);
  const listIds = [...jobs.map((j) => j.id), ...featured.map((j) => j.id)];
  const { data: earlyIds } = listIds.length ? await (await createClient()).rpc('early_jobs', { ids: listIds }) : { data: [] };
  const early = new Set(((earlyIds ?? []) as string[]));
  const speed = await responseDays([...jobs, ...featured].map((j) => j.company_id));
  const responds = (j: { company_id: string }) => responseLabel(speed.get(j.company_id));
  const featuredIds = new Set(featured.map((j) => j.id));
  const hasFilters = Object.values(searchParams).some(Boolean);

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page py-12">
          <p className="eyebrow text-brass">Find Jobs</p>
          <h1 className="mt-3 font-serif text-5xl font-medium text-ivory">Your next mission.</h1>
          <form action="/jobs" method="get" className="mt-8 grid gap-2 rounded-2xl bg-ivory p-2 shadow-lift md:grid-cols-[1fr_240px_auto]">
            <label htmlFor="q" className="sr-only">Job title, keyword, or company</label>
            <input id="q" name="q" defaultValue={searchParams.q} placeholder="Job title, keyword, or company" className="rounded-lg px-4 py-3 text-ink outline-none" />
            <label htmlFor="state" className="sr-only">Location</label>
            <select id="state" name="state" defaultValue={searchParams.state ?? ''} className="rounded-lg bg-ivory px-4 py-3 text-ink outline-none md:border-l md:border-line">
              <option value="">Any location</option>
              <option value="multi">Multiple locations</option>
              {US_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
            {arrangements.map((a) => <input key={a} type="hidden" name="arrangement" value={a} />)}
            {searchParams.location && <input type="hidden" name="location" value={searchParams.location} />}
            {searchParams.type && <input type="hidden" name="type" value={searchParams.type} />}
            {searchParams.clearance && <input type="hidden" name="clearance" value={searchParams.clearance} />}
            {searchParams.poly && <input type="hidden" name="poly" value={searchParams.poly} />}
            {searchParams.veteran && <input type="hidden" name="veteran" value={searchParams.veteran} />}
            {searchParams.pcs && <input type="hidden" name="pcs" value={searchParams.pcs} />}
            {searchParams.employer && <input type="hidden" name="employer" value={searchParams.employer} />}
            <button type="submit" className="btn btn-primary">Search</button>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Work arrangement (pick one or more)">
            <Link href={hrefWith({ arrangement: null })} aria-current={!arrangements.length ? 'true' : undefined}
              className={`rounded-full border px-4 py-1.5 text-sm ${!arrangements.length ? 'border-brass bg-brass text-navy' : 'border-cream/30 text-cream hover:border-brass'}`}>Any</Link>
            {ARRANGEMENTS.map(([v, l]) => {
              const on = arrangements.includes(v);
              return (
                <Link key={v} href={toggle(v)} aria-pressed={on} role="button"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm ${on ? 'border-brass bg-brass text-navy' : 'border-cream/30 text-cream hover:border-brass'}`}>
                  {on && <span aria-hidden="true">✓</span>}{l}
                </Link>
              );
            })}
          </div>
          {place && <p className="mt-3 text-sm text-cream/80">{place}.</p>}
        </div>
      </section>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[260px_1fr]">
        <aside>
          <form action="/jobs" method="get" className="card space-y-5 p-5 lg:sticky lg:top-24">
            <p className="eyebrow">Filters</p>
            {searchParams.q && <input type="hidden" name="q" value={searchParams.q} />}
            {searchParams.location && <input type="hidden" name="location" value={searchParams.location} />}
            <div>
              <label htmlFor="f-state" className="field-label">State</label>
              <select id="f-state" name="state" defaultValue={searchParams.state ?? ''} className="field">
                <option value="">Anywhere</option>
                <option value="multi">Multiple locations</option>
                {US_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </div>
            <fieldset>
              <legend className="field-label">Work arrangement</legend>
              <div className="mt-1 space-y-2">
                {ARRANGEMENTS.map(([v, l]) => (
                  <label key={v} className="flex items-center gap-2.5 text-sm text-ink">
                    <input type="checkbox" name="arrangement" value={v} defaultChecked={arrangements.includes(v)} className="h-4 w-4 accent-navy" />{l}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">Pick one or more. With a state picked, remote jobs from anywhere are included, and hybrid and on-site jobs are in that state.</p>
            </fieldset>
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
            <div>
              <label htmlFor="poly" className="field-label">Polygraph</label>
              <select id="poly" name="poly" defaultValue={searchParams.poly ?? ''} className="field">
                <option value="">Any</option><option value="any">Polygraph required</option><option value="none">No polygraph</option>
              </select>
            </div>
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input type="checkbox" name="veteran" value="1" defaultChecked={searchParams.veteran === '1'} className="h-4 w-4 accent-navy" />
              Veteran preferred only
            </label>
            <label className="flex items-start gap-2.5 text-sm text-ink">
              <input type="checkbox" name="pcs" value="1" defaultChecked={searchParams.pcs === '1'} className="mt-0.5 h-4 w-4 accent-navy" />
              <span>Keeps through a PCS move<span className="block text-xs text-muted">Remote, or hiring in several locations</span></span>
            </label>
            <div>
              <label htmlFor="employer" className="field-label">Employer commitments</label>
              <select id="employer" name="employer" defaultValue={searchParams.employer ?? ''} className="field">
                <option value="">Any verified employer</option>
                <option value="msep">Military Spouse Employment Partnership</option>
                <option value="guard">Guard &amp; Reserve pledge</option>
              </select>
            </div>
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
            {place ? <> · {place.charAt(0).toLowerCase() + place.slice(1)}</> : searchParams.location ? <> near {searchParams.location}</> : null}
          </p>
          {jobs.length === 0 ? (
            <EmptyState
              title="No positions match that search yet."
              body="Try a broader title, a different location, or clear your filters. New roles are posted every week."
              action={{ href: '/jobs', label: 'See all jobs' }}
            />
          ) : (
            <div className="space-y-4">
              {!Object.values(searchParams).some(Boolean) && <RecommendedJobs limit={5} />}
              {!Object.values(searchParams).some(Boolean) && featured.map((job) => <JobCard key={`f-${job.id}`} job={job} early={early.has(job.id)} responds={responds(job)} />)}
              {jobs.filter((job) => Object.values(searchParams).some(Boolean) || !featuredIds.has(job.id)).map((job) => <JobCard key={job.id} job={job} early={early.has(job.id)} responds={responds(job)} />)}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
