import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CompanyMark from '@/components/CompanyMark';
import ShareButton from '@/components/ShareButton';
import SubmitButton from '@/components/SubmitButton';
import { getJobBySlug } from '@/lib/jobs';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ARRANGEMENT_LABELS, CLEARANCE_LABELS, EMPLOYMENT_LABELS, formatSalary, postedAgo } from '@/lib/format';
import { applyToJob, toggleSaveJob } from '../actions';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const job = await getJobBySlug(params.slug);
  if (!job) return { title: 'Job not found' };
  const where = job.location ? ` in ${job.location}` : '';
  return {
    title: `${job.title}${job.company ? ` at ${job.company.name}` : ''}`,
    description: `${job.title}${where}. ${job.description.slice(0, 140)}`,
  };
}

function Section({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return (
    <section className="border-t border-line pt-6">
      <h2 className="eyebrow">{title}</h2>
      {lines.length > 1 ? (
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink/85">
          {lines.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      ) : (
        <p className="mt-3 text-[15px] leading-relaxed text-ink/85">{lines[0]}</p>
      )}
    </section>
  );
}

export default async function JobDetailPage({ params }: { params: { slug: string } }) {
  const job = await getJobBySlug(params.slug);
  if (!job) notFound();

  const session = await getSessionProfile();
  if (session) {
    // One view per member per job per day; duplicates are ignored.
    await createClient().from('job_views').insert({ job_id: job.id, viewer_id: session.user.id }).then(() => undefined, () => undefined);
  }
  const isVeteran = session?.profile?.role === 'veteran';

  let saved = false;
  let applicationStatus: string | null = null;
  if (isVeteran && session) {
    const supabase = createClient();
    const [{ data: s }, { data: a }] = await Promise.all([
      supabase.from('saved_jobs').select('job_id').eq('profile_id', session.user.id).eq('job_id', job.id).maybeSingle(),
      supabase.from('applications').select('status').eq('profile_id', session.user.id).eq('job_id', job.id).maybeSingle(),
    ]);
    saved = !!s;
    applicationStatus = (a?.status as string | undefined) ?? null;
  }

  const salary = formatSalary(job.salary_min, job.salary_max, job.salary_period);
  const applied = applicationStatus && applicationStatus !== 'withdrawn';
  const next = encodeURIComponent(`/jobs/${job.slug}`);

  return (
    <div className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_320px]">
      <article>
        <Link href="/jobs" className="text-sm text-muted hover:text-navy">← All jobs</Link>
        <div className="mt-6 flex items-start gap-4">
          <CompanyMark name={job.company?.name ?? 'Company'} logoUrl={job.company?.logo_url} size="lg" />
          <div>
            <h1 className="font-serif text-4xl font-medium leading-tight sm:text-5xl">{job.title}</h1>
            <p className="mt-2 text-muted">
              {job.company && (
                <Link href={`/companies/${job.company.slug}`} className="text-navy underline decoration-brass/60 underline-offset-4">
                  {job.company.name}
                </Link>
              )}
              {job.location && <> · {job.location}</>} · {postedAgo(job.posted_at)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="pill">{ARRANGEMENT_LABELS[job.work_arrangement]}</span>
          <span className="pill">{EMPLOYMENT_LABELS[job.employment_type]}</span>
          {salary && <span className="pill font-semibold text-navy">{salary}</span>}
          {job.veteran_preferred && <span className="pill border-brass/50 bg-brass/10 text-brass-dark">Veteran preferred</span>}
          {job.clearance_required !== 'none' && (
            <span className="pill border-navy/30 bg-navy/5 text-navy">{CLEARANCE_LABELS[job.clearance_required]} clearance required</span>
          )}
          {job.clearance_eligible && job.clearance_required === 'none' && <span className="pill">Clearance eligible</span>}
        </div>

        <div className="mt-8 space-y-6">
          <p className="text-[16px] leading-relaxed text-ink/90">{job.description}</p>
          <Section title="Responsibilities" text={job.responsibilities} />
          <Section title="Qualifications" text={job.qualifications} />
          <Section title="Preferred qualifications" text={job.preferred_qualifications} />
          <Section title="Benefits" text={job.benefits} />
          {job.military_transferable && (
            <section className="rounded-[4px] border border-brass/40 bg-brass/5 p-5">
              <h2 className="eyebrow">Why this role may fit your experience</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-ink/85">
                This employer counts military experience toward this role’s requirements. Leading people, executing under
                pressure, and accountability for equipment and outcomes all translate directly.
                {' '}<Link href="/resources" className="text-navy underline decoration-brass underline-offset-4">See how your MOS translates →</Link>
              </p>
            </section>
          )}
        </div>
      </article>

      <aside className="lg:pt-12">
        <div className="card space-y-3 p-6 lg:sticky lg:top-24">
          {!session && (
            <>
              <Link href={`/login?next=${next}`} className="btn btn-primary w-full">Log in to apply</Link>
              <Link href={`/signup?role=veteran`} className="btn btn-outline w-full">Create a free profile</Link>
            </>
          )}

          {isVeteran && (
            <>
              {applied ? (
                <p className="rounded-[3px] border border-olive/30 bg-olive/10 px-4 py-3 text-center text-sm font-medium text-olive">
                  ✓ Applied — status: {applicationStatus}
                </p>
              ) : (
                <form action={applyToJob.bind(null, job.id, job.slug)}>
                  <SubmitButton pendingText="Submitting…">Apply now</SubmitButton>
                </form>
              )}
              <form action={toggleSaveJob.bind(null, job.id, job.slug)}>
                <SubmitButton className="btn btn-outline w-full" pendingText="Saving…">
                  {saved ? '★ Saved' : '☆ Save job'}
                </SubmitButton>
              </form>
            </>
          )}

          {session && !isVeteran && (
            <p className="text-sm text-muted">You’re signed in as an {session.profile?.role}. Veteran accounts can apply and save jobs.</p>
          )}

          <ShareButton title={`${job.title} — LanceNest`} />
        </div>
      </aside>
    </div>
  );
}
