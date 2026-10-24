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
import { applyToJob, confirmSiteApply, toggleSaveJob } from '../actions';
import CompanySiteApply from '@/components/jobs/CompanySiteApply';
import FitExplainer from '@/components/jobs/FitExplainer';
import { AI_ENABLED } from '@/lib/ai';
import { responseDays, responseLabel } from '@/lib/responsiveness';
import { createAdminClient } from '@/lib/supabase/admin';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
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

export default async function JobDetailPage(
  props: { params: Promise<{ slug: string }>; searchParams?: Promise<{ apply?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const job = await getJobBySlug(params.slug);
  if (!job) notFound();

  const session = await getSessionProfile();
  const isVeteran = (!!session && ['veteran', 'admin'].includes(session.profile?.role ?? ''));
  // Employer commitments and response speed (public facts about the employer, read with the server key).
  const [speed, { data: commit }, { data: atsConn }] = await Promise.all([
    responseDays([job.company_id]),
    createAdminClient().from('companies').select('msep_status, guard_reserve_pledge').eq('id', job.company_id).maybeSingle(),
    createAdminClient().from('ats_connections').select('provider').eq('company_id', job.company_id).maybeSingle(),
  ]);
  const toEmployerSystem = !!atsConn && job.external_source === atsConn.provider;
  const fast = responseLabel(speed.get(job.company_id));
  const supabase = await createClient();
  const none = Promise.resolve({ data: null });
  // Everything below depends only on the job and the viewer: one round of queries.
  const [{ data: earlyRows }, { data: insightRows }, { data: myResumesRows }, , { data: s }, { data: a }, { data: me }] = await Promise.all([
    supabase.rpc('early_jobs', { ids: [job.id] }),
    isVeteran ? supabase.rpc('applicant_insight', { j: job.id }) : Promise.resolve({ data: [] }),
    isVeteran && session ? supabase.from('resumes').select('id, file_name, is_default').eq('profile_id', session.user.id).order('uploaded_at', { ascending: false }) : Promise.resolve({ data: [] }),
    // One view per member per job per day; duplicates are ignored.
    session ? supabase.from('job_views').insert({ job_id: job.id, viewer_id: session.user.id }).then(() => undefined, () => undefined) : Promise.resolve(undefined),
    isVeteran && session ? supabase.from('saved_jobs').select('job_id').eq('profile_id', session.user.id).eq('job_id', job.id).maybeSingle() : none,
    isVeteran && session ? supabase.from('applications').select('status, source').eq('profile_id', session.user.id).eq('job_id', job.id).maybeSingle() : none,
    session?.profile?.role === 'veteran' ? supabase.from('veteran_profiles').select('verification_status').eq('profile_id', session.user.id).maybeSingle() : none,
  ]);
  // Applying needs a verified account (admins can always apply).
  const canApply = session?.profile?.role === 'admin' || (me as { verification_status?: string } | null)?.verification_status === 'verified';
  const isEarly = ((earlyRows ?? []) as string[]).length > 0;
  const insight = ((insightRows ?? []) as { stronger_than_pct: number; verified_pct: number; applicants_bucket: string }[])[0] ?? null;
  const myResumes = (myResumesRows ?? []) as { id: string; file_name: string; is_default: boolean }[];

  let saved = false;
  let applicationStatus: string | null = null;
  let appliedOnSite = false;
  if (isVeteran && session) {
    saved = !!s;
    applicationStatus = (a?.status as string | undefined) ?? null;
    appliedOnSite = (a as { source?: string } | null)?.source === 'external';
  }

  const salary = formatSalary(job.salary_min, job.salary_max, job.salary_period);
  const applied = applicationStatus && applicationStatus !== 'withdrawn';
  // How this employer takes applications (set on the job post), like LinkedIn's Easy Apply vs. company website.
  const mode = job.apply_mode ?? (job.apply_url ? 'both' : 'easy');
  const easyApply = mode !== 'external';
  const siteApply = mode !== 'easy' && !!job.apply_url;
  const companyName = job.company?.name ?? 'the company';
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
            {(fast || commit?.msep_status === 'verified' || commit?.guard_reserve_pledge) && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                {fast && <span className="rounded-full border border-olive/40 bg-olive/10 px-3 py-1 text-olive">{fast}</span>}
                {commit?.msep_status === 'verified' && <span className="rounded-full border border-navy/30 bg-navy/5 px-3 py-1 text-navy">Military Spouse Employment Partner</span>}
                {commit?.guard_reserve_pledge && <span className="rounded-full border border-navy/30 bg-navy/5 px-3 py-1 text-navy">Guard &amp; Reserve pledge</span>}
              </div>
            )}
            {isEarly && <p className="mt-2 inline-block rounded-full border border-brass/60 bg-brass/10 px-3 py-1 text-xs font-semibold text-brass-dark">Be an early applicant</p>}
            {(!!session && ['veteran', 'admin'].includes(session.profile?.role ?? '')) && (insight ? (
              <div className="mt-4 rounded-xl border border-navy/20 bg-paper p-4 text-sm">
                <p className="font-semibold text-navy">Your applicant insights</p>
                <p className="mt-1">Your skills match is stronger than or equal to <strong>{insight.stronger_than_pct}%</strong> of applicants · {insight.verified_pct}% of applicants are verified · {insight.applicants_bucket} applicants so far</p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted">See how your skills compare with other applicants — <Link href="/plans" className="text-navy underline">applicant insights with Pro</Link>.</p>
            ))}
            {job.employment_type === 'skillbridge' && (
              <div className="mt-4 rounded-xl border border-olive/40 bg-olive/5 p-4 text-sm">
                <p className="font-semibold text-olive">DoD SkillBridge program{(job as unknown as { skillbridge_weeks?: number }).skillbridge_weeks ? ` · ${(job as unknown as { skillbridge_weeks: number }).skillbridge_weeks} weeks` : ''}</p>
                <p className="mt-1 text-ink/80">You keep your full military pay and benefits; the company doesn’t pay you. You’ll need an approved separation date, completed TAP, and written approval from your first O-4 commander, and you can start up to 180 days before separation.</p>
                <Link href="/transition" className="mt-2 inline-block text-navy underline">Plan it in your Transition Hub →</Link>
                <p className="mt-2 text-xs text-muted">LanceNest listing — not a DoD endorsement. Confirm the organization on the official SkillBridge site before applying.</p>
              </div>
            )}
            {(!!session && ['veteran', 'admin'].includes(session.profile?.role ?? '')) && (
              <details className="mt-3 text-xs text-muted">
                <summary className="cursor-pointer hover:text-signal">Something wrong with this job? Report it</summary>
                <form action={reportContent.bind(null, 'job', job.id)} data-close data-reset data-done="Thanks. Your report was received, and our team will review this job." className="mt-2 flex max-w-md flex-col gap-2 sm:flex-row">
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
            <span className="pill border-navy/30 bg-navy/5 text-navy">{CLEARANCE_LABELS[job.clearance_required]}{(job as unknown as { polygraph_required?: string }).polygraph_required === 'full_scope' ? ' w/ Full-Scope Poly' : (job as unknown as { polygraph_required?: string }).polygraph_required === 'ci' ? ' w/ CI Poly' : ''} clearance required</span>
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
            <section className="rounded-xl border border-brass/40 bg-brass/5 p-5">
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

          {searchParams?.apply === 'done' && <p className="rounded-lg bg-olive/10 px-4 py-3 text-sm text-olive">✓ Application sent. Track it under My applications.</p>}
          {searchParams?.apply === 'answers' && <p className="rounded-lg bg-signal/10 px-4 py-3 text-sm text-signal">Please answer every question to apply.</p>}
          {searchParams?.apply === 'error' && <p className="rounded-lg bg-signal/10 px-4 py-3 text-sm text-signal">Your application didn’t go through. Make sure your profile is verified, then try again.</p>}
          {isVeteran && canApply && AI_ENABLED && <FitExplainer slug={job.slug} />}
          {isVeteran && (
            <>
              {!canApply ? (
                <div className="rounded-xl border border-brass/50 bg-brass/10 p-4 text-sm">
                  <p className="font-medium text-ink">Get verified to apply</p>
                  <p className="mt-1 text-xs text-muted">Employers on LanceNest hear only from verified service members. Verification takes a few minutes to submit.</p>
                  <Link href="/dashboard/verification" className="btn btn-primary mt-3 w-full">Verify my service</Link>
                </div>
              ) : applied && !appliedOnSite ? (
                <p className="rounded-xl border border-olive/30 bg-olive/10 px-4 py-3 text-center text-sm font-medium text-olive">
                  ✓ Applied — status: {applicationStatus}
                </p>
              ) : (
                <>
                  {/* Applied on the company's own site (they can still Easy Apply when the job offers both). */}
                  {applied && appliedOnSite && (
                    <div className="rounded-xl border border-navy/20 bg-navy/[0.04] px-4 py-3 text-center text-sm text-navy">
                      <p className="font-medium">✓ Applied on {companyName}’s site</p>
                      <p className="mt-1 text-xs"><Link href="/dashboard/applications" className="underline underline-offset-2">Track it in My applications</Link>
                        {siteApply && <> · <a href={`/api/jobs/${job.id}/external`} target="_blank" rel="noopener" className="underline underline-offset-2">Open their application ↗</a></>}</p>
                      <form action={confirmSiteApply.bind(null, job.id, job.slug, false)} data-done="Removed from My applications." className="mt-2">
                        <SubmitButton className="text-xs text-muted underline underline-offset-2 hover:text-ink" pendingText="…">Didn’t finish applying? Remove it</SubmitButton>
                      </form>
                      {easyApply && <p className="mt-2 text-xs text-muted">You can still Easy Apply below.</p>}
                    </div>
                  )}
                  {!applied && siteApply && !easyApply && <CompanySiteApply jobId={job.id} slug={job.slug} company={companyName} primary />}
                  {easyApply && (
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
                      {((job as unknown as { screening_questions?: { q: string; type: string }[] }).screening_questions ?? []).map((q, i) => (
                        <div key={i}>
                          <label className="field-label" htmlFor={`answer_${i}`}>{q.q}</label>
                          {q.type === 'yesno'
                            ? <select id={`answer_${i}`} name={`answer_${i}`} required defaultValue="" className="field text-sm"><option value="" disabled>Choose…</option><option>Yes</option><option>No</option></select>
                            : <textarea id={`answer_${i}`} name={`answer_${i}`} required rows={2} maxLength={1000} className="field text-sm" />}
                        </div>
                      ))}
                      <SubmitButton pendingText="Submitting…">{siteApply ? 'Easy Apply on LanceNest' : 'Easy Apply'}</SubmitButton>
                      {toEmployerSystem && <p className="text-xs text-muted">This employer receives applications in its own hiring system, so your name, email, résumé and answers are sent there too.</p>}
                    </form>
                  )}
                  {!applied && siteApply && easyApply && <CompanySiteApply jobId={job.id} slug={job.slug} company={companyName} primary={false} />}
                </>
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
