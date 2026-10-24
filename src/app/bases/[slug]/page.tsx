import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BASES, baseBySlug } from '@/lib/bases';
import { allPublicJobs, type IndexedJob } from '@/lib/publicJobs';
import { locatedIn } from '@/lib/place';
import { createAdminClient } from '@/lib/supabase/admin';
import { CANONICAL_ORIGIN } from '@/lib/seo';
import { ARRANGEMENT_LABELS, formatSalary, postedAgo } from '@/lib/format';

export const revalidate = 3600;
export function generateStaticParams() { return BASES.map((b) => ({ slug: b.slug })); }

/** Jobs near a base: nearby towns first, then elsewhere in the state; remote jobs are counted separately. */
async function nearby(slug: string) {
  const base = baseBySlug(slug);
  if (!base) return null;
  const all = await allPublicJobs();
  const near = (j: IndexedJob) => base.near.some((t) => (j.job.location ?? '').toLowerCase().includes(t.toLowerCase()));
  const inState = (j: IndexedJob) => j.job.work_arrangement !== 'remote' && base.states.some((st) => locatedIn(j.job.location, st));
  const local = all.filter((j) => j.job.work_arrangement !== 'remote' && (near(j) || inState(j))).sort((a, b) => Number(near(b)) - Number(near(a)));
  const remote = all.filter((j) => j.job.work_arrangement === 'remote').length;
  const skillbridge = local.filter((j) => j.job.employment_type === 'skillbridge');
  const employers = new Set(local.map((j) => j.companyId)).size;
  return { base, local, remote, skillbridge, employers };
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = await nearby((await props.params).slug);
  if (!d) return {};
  return {
    title: `Jobs near ${d.base.name}`,
    description: `Open jobs, SkillBridge openings and career fairs near ${d.base.name} (${d.base.city}) from employers verified by LanceNest.`,
    alternates: { canonical: `${CANONICAL_ORIGIN}/bases/${d.base.slug}` },
    ...(d.local.length ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function BasePage(props: { params: Promise<{ slug: string }> }) {
  const d = await nearby((await props.params).slug);
  if (!d) notFound();
  const { base, local, remote, skillbridge, employers } = d;
  const { data: fairs } = await createAdminClient().from('career_fairs').select('id, title, starts_at').gt('ends_at', new Date().toISOString()).order('starts_at').limit(3);
  const stateParam = base.states[0];
  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page py-14">
          <Link href="/bases" className="text-sm text-cream/70 hover:text-brass">← All bases</Link>
          <p className="eyebrow mt-4 text-brass">{base.branch} · {base.city}</p>
          <h1 className="mt-2 font-serif text-4xl font-medium text-ivory sm:text-5xl">Jobs near {base.name}</h1>
          <p className="mt-3 max-w-2xl text-cream/80">For service members separating from {base.name} and spouses who just arrived: jobs from employers verified by LanceNest, with pay posted on every one.</p>
          {local.length > 0 && <dl className="mt-8 grid max-w-2xl grid-cols-3 gap-4 text-center">
            <div><dt className="text-xs uppercase tracking-[0.12em] text-cream/70">Nearby jobs</dt><dd className="font-serif text-3xl text-ivory">{local.length}</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.12em] text-cream/70">Remote jobs</dt><dd className="font-serif text-3xl text-ivory">{remote}</dd></div>
            <div><dt className="text-xs uppercase tracking-[0.12em] text-cream/70">Hiring employers</dt><dd className="font-serif text-3xl text-ivory">{employers}</dd></div>
          </dl>}
        </div>
      </section>
      <div className="container-page grid gap-8 py-12 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="eyebrow">Open jobs near {base.name}</h2>
            {local.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No public listings near {base.name} yet. Verified members see every job, including ones employers keep off public pages{remote > 0 ? <>, and {remote.toLocaleString()} remote job{remote === 1 ? ' works' : 's work'} from anywhere</> : null}.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {local.slice(0, 20).map(({ job }) => (
                  <li key={job.slug} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div className="min-w-0"><Link href={`/open-jobs/${job.slug}`} className="font-medium text-navy hover:underline">{job.title}</Link><p className="text-xs text-muted">Verified employer · {job.location ?? ARRANGEMENT_LABELS[job.work_arrangement]} · {postedAgo(job.posted_at)}</p></div>
                    {formatSalary(job.salary_min, job.salary_max, job.salary_period) && <span className="text-sm font-semibold text-navy">{formatSalary(job.salary_min, job.salary_max, job.salary_period)}</span>}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link href={`/open-jobs?where=${stateParam}`} className="text-navy underline decoration-brass underline-offset-4">All jobs in {stateParam} →</Link>
              <Link href="/open-jobs?pcs=1" className="text-navy underline decoration-brass underline-offset-4">Jobs that keep through a PCS →</Link>
            </div>
          </section>
          {skillbridge.length > 0 && (
            <section className="card p-6">
              <h2 className="eyebrow">SkillBridge openings nearby</h2>
              <ul className="mt-3 space-y-2">{skillbridge.slice(0, 10).map(({ job }) => <li key={job.slug}><Link href={`/open-jobs/${job.slug}`} className="text-navy hover:underline">{job.title}</Link></li>)}</ul>
              <p className="mt-3 text-xs text-muted">SkillBridge needs your command’s approval. <Link href="/guides/how-to-use-dod-skillbridge" className="text-navy underline">How SkillBridge works</Link></p>
            </section>
          )}
        </div>
        <aside className="space-y-4">
          <div className="card p-6"><p className="eyebrow">Getting out?</p><p className="mt-2 text-sm text-muted">Translate your MOS, rating or AFSC into civilian roles, then apply with a verified profile.</p><Link href="/resources" className="btn btn-outline mt-4 w-full">Translate your MOS</Link><Link href="/signup?role=veteran" className="btn btn-primary mt-2 w-full">Join free</Link></div>
          {(fairs ?? []).length > 0 && (
            <div className="card p-6"><p className="eyebrow">Upcoming virtual fairs</p><ul className="mt-2 space-y-2 text-sm">{(fairs ?? []).map((f) => <li key={f.id as string}><Link href="/fairs" className="text-navy hover:underline">{f.title as string}</Link><span className="block text-xs text-muted">{new Date(f.starts_at as string).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span></li>)}</ul></div>
          )}
          <div className="card p-6"><p className="eyebrow">Hiring near {base.name}?</p><p className="mt-2 text-sm text-muted">Post jobs free and reach verified service members and spouses here.</p><Link href="/employers" className="btn btn-outline mt-3 w-full">For employers</Link></div>
        </aside>
      </div>
    </>
  );
}
