import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicJob, jobPostingJsonLd, ldJson } from '@/lib/publicJobs';
import { ARRANGEMENT_LABELS, CLEARANCE_LABELS, EMPLOYMENT_LABELS, formatSalary, postedAgo } from '@/lib/format';
import { CANONICAL_ORIGIN } from '@/lib/seo';

// Rebuilt at most hourly, and right away when the employer edits or closes the job.
export const revalidate = 3600;

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const job = await getPublicJob(slug);
  if (!job) return { title: 'Job not found', robots: { index: false } };
  const where = job.location ? ` in ${job.location}` : job.work_arrangement === 'remote' ? ' (remote)' : '';
  const title = `${job.title}${where}`;
  const description = `${job.title}${where} with a verified employer. ${job.description.slice(0, 120)}`;
  return {
    title,
    description,
    alternates: { canonical: `${CANONICAL_ORIGIN}/open-jobs/${job.slug}` },
    openGraph: { title, description, url: `${CANONICAL_ORIGIN}/open-jobs/${job.slug}`, type: 'website' },
  };
}

function Section({ title, text }: { title: string; text: string | null }) {
  const lines = (text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  return (
    <section className="border-t border-line pt-6">
      <h2 className="eyebrow">{title}</h2>
      {lines.length > 1 ? (
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink/85">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
      ) : (
        <p className="mt-3 text-[15px] leading-relaxed text-ink/85">{lines[0]}</p>
      )}
    </section>
  );
}

export default async function PublicJobPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const job = await getPublicJob(slug);
  if (!job) notFound();
  const salary = formatSalary(job.salary_min, job.salary_max, job.salary_period);
  const memberUrl = `/jobs/${job.slug}`;
  const poly = job.polygraph_required === 'full_scope' ? ' w/ Full-Scope Poly' : job.polygraph_required === 'ci' ? ' w/ CI Poly' : '';

  return (
    <div className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_320px]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(jobPostingJsonLd(job)) }} />
      <article className="min-w-0">
        <Link href="/open-jobs" className="text-sm text-muted hover:text-navy">← Open jobs</Link>
        <h1 className="mt-6 font-serif text-4xl font-medium leading-tight sm:text-5xl">{job.title}</h1>
        <p className="mt-2 text-muted">
          Verified employer{job.location && <> · {job.location}</>} · {postedAgo(job.posted_at)}
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-olive/40 bg-olive/10 px-3 py-1 text-xs font-semibold text-olive">
          ✓ Employer reviewed by LanceNest
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="pill">{ARRANGEMENT_LABELS[job.work_arrangement]}</span>
          <span className="pill">{EMPLOYMENT_LABELS[job.employment_type]}</span>
          {salary && <span className="pill font-semibold text-navy">{salary}</span>}
          {job.veteran_preferred && <span className="pill border-brass/50 bg-brass/10 text-brass-dark">Veteran preferred</span>}
          {job.clearance_required !== 'none' && <span className="pill border-navy/30 bg-navy/5 text-navy">{CLEARANCE_LABELS[job.clearance_required]}{poly} clearance required</span>}
          {job.clearance_eligible && job.clearance_required === 'none' && <span className="pill">Clearance eligible</span>}
        </div>

        <div className="mt-8 space-y-6">
          <p className="whitespace-pre-line text-[16px] leading-relaxed text-ink/90">{job.description}</p>
          <Section title="Responsibilities" text={job.responsibilities} />
          <Section title="Qualifications" text={job.qualifications} />
          <Section title="Preferred qualifications" text={job.preferred_qualifications} />
          <Section title="Benefits" text={job.benefits} />
        </div>
      </article>

      <aside className="lg:pt-12">
        <div className="card space-y-3 p-6 lg:sticky lg:top-24">
          <p className="font-semibold text-ink">Apply with your verified profile</p>
          <p className="text-sm text-muted">This employer hires through LanceNest. Their name, company page and application are shown to verified service members, veterans and military spouses once they log in.</p>
          <Link href={memberUrl} className="btn btn-primary w-full">Apply on LanceNest</Link>
          <Link href="/signup?role=veteran" className="btn btn-outline w-full">New here? Create a free profile</Link>
          <p className="text-xs text-muted">Free for service members. Every member is verified by a person.</p>
        </div>
      </aside>
    </div>
  );
}
