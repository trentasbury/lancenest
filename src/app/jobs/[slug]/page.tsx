import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CompanyMark from '@/components/CompanyMark';
import ShareButton from '@/components/ShareButton';
import SubmitButton from '@/components/SubmitButton';
import { getJobBySlug } from '@/lib/jobs';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { reportContent } from '@/app/network/actions';
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
  const [{ data: earlyRows }, { data: insightRows }] = await Promise.all([
    createClient().rpc('early_jobs', { ids: [job.id] }),
    (!!session && ['veteran', 'admin'].includes(session.profile?.role ?? '')) ? createClient().rpc('applicant_insight', { j: job.id }) : Promise.resolve({ data: [] }),
  ]);
  const isEarly = ((earlyRows ?? []) as string[]).length > 0;
  const insight = ((insightRows ?? []) as { stronger_than_pct: number; verified_pct: number; applicants_bucket: string }[])[0] ?? null;
  const { data: myResumes } = (!!session && ['veteran', 'admin'].includes(session.profile?.role ?? ''))
    ? await createClient().from('resumes').select('id, file_name, is_default').eq('profile_id', session.user.id).order('uploaded_at', { ascending: false })
    : { data: [] as { id: string; file_name: string; is_default: boolean }[] };
  if (session) {
    // One view per member per job per day; duplicates are ignored.
    await createClient().from('job_views').insert({ job_id: job.id, viewer_id: session.user.id }).then(() => undefined, () => undefined);
  }
  const isVeteran = (!!session && ['veteran', 'admin'].includes(session.profile?.role ?? ''));

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
            {job.company?.is_verified && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-olive/40 bg-olive/10 px-3 py-1 text-xs font-semibold text-olive">
                ✓ Verified company — reviewed by LanceNest
              </p>
            )}
            {isEarly && <p className="mt-2 inline-block rounded-full border border-brass/60 bg-brass/10 px-3 py-1 text-xs font-semibold text-brass-dark">Be an early applicant</p>}
            {(!!session && ['veteran', 'admin'].includes(session.profile?.role ?? '')) && (insight ? (
              <div className="mt-4 rounded-[4px] border border-navy/20 bg-paper p-4 text-sm">
                <p className="font-semibold text-navy">Your applicant insights</p>
                <p className="mt-1">Your skills match is stronger than or equal to <strong>{insight.stronger_than_pct}%</strong> of applicants · {insight.verified_pct}% of applicants are verified · {insight.applicants_bucket} applicants so far</p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted">See how your skills compare with other applicants — <Link href="/plans" className="text-navy underline">applicant insights with Pro</Link>.</p>
            ))}
            {job.employment_type === 'skillbridge' && (
              <div className="mt-4 rounded-[4px] border border-olive/40 bg-olive/5 p-4 text-sm">
                <p className="font-semibold text-olive">DoD SkillBridge program{(job as unknown as { skillbridge_weeks?: number }).skillbridge_weeks ? ` · ${(job as unknown as { skillbridge_weeks: number }).skillbridge_weeks} weeks` : ''}</p>
                <p className="mt-1 text-ink/80">You keep your full military pay and benefits; the company doesn’t pay you. You’ll need an approved separation date, completed TAP, and written approval from your first O-4 commander, and you can start up to 180 days before separation.</p>
                <Link href="/transition" className="mt-2 inline-block text-navy underline">Plan it in your Transition Hub →</Link>
              </div>
            )}
            {(!!session && ['veteran', 'admin'].includes(session.profile?.role ?? '')) && (
              <details className="mt-3 text-xs text-muted">
                <summary className="cursor-pointer hover:text-signal">Something wrong with this job? Report it</summary>
                <form action={reportContent.bind(null, 'job', job.id)} className="mt-2 flex max-w-md flex-col gap-2 sm:flex-row">
                  <select name="reason" required defaultValue="" className="field py-2 text-sm">
                    <option value="" disabled>Reason…</option>
                    <option value="fake_job">Fake or scam job</option>
                    <option value="fraud">Asked for money or personal info</option>
                    <option value="impersonation">Impersonating a company</option>
                    <option value="inappropriate">Inappropriate</option>
                    <option value="sensitive_info">Shares SSN, personal info, or OPSEC-sensitive details</option><option value="other">Other</option>
                  </select>
                  <SubmitButton className="btn btn-outline py-2" pendingText="…">Report</SubmitButton>
                </form>
              </details>
            )}
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
                <form action={applyToJob.bind(null, job.id, job.slug)} className="space-y-2">
                  {(myResumes ?? []).length > 0 ? (
                    <div>
                      <label htmlFor="resume_id" className="field-label">Résumé to send</label>
                      <select id="resume_id" name="resume_id" defaultValue={((myResumes ?? []).find((r) => r.is_default)?.id as string) ?? ''} className="field text-sm">
                        {(myResumes ?? []).map((r) => <option key={r.id as string} value={r.id as string}>{r.file_name as string}</option>)}
                        <option value="">Apply without a résumé</option>
                      </select>
                      <p className="mt-1 text-[11px] text-muted">Only {job.company?.name ?? 'this company'} will see it.</p>
                    </div>
                  ) : <p className="text-xs text-muted"><Link href="/dashboard/profile#resume" className="underline">Add a résumé</Link> to stand out.</p>}
                  <SubmitButton pendingText="Submitting…">{(job as unknown as { apply_url?: string }).apply_url ? 'Easy Apply on LanceNest' : 'Apply now'}</SubmitButton>
                </form>
              )}
              {!applied && (job as unknown as { apply_url?: string }).apply_url && (
                <a href={`/api/jobs/${job.id}/external`} className="btn btn-outline w-full">Apply on company site ↗</a>
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
