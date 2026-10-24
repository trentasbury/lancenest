'use client';

import { useEffect, useRef, useState } from 'react';
import { useActionState } from 'react';
import type { Job } from '@/lib/types';
import type { JobFormState } from '@/app/employer/jobs/actions';
import { applyLinkProblem } from '@/lib/applyLinks';
import SubmitButton from '../SubmitButton';
import JobErrors from './JobErrors';

// Like LinkedIn: applicants come to you on LanceNest, go to your own careers site, or choose.
const APPLY_MODES = [
  ['easy', 'Easy Apply on LanceNest', 'Résumé and screening answers land in your applicant list.'],
  ['external', 'Your website', 'Veterans finish on your careers site or applicant-tracking system.'],
  ['both', 'Both', 'Veterans choose Easy Apply or your site.'],
] as const;
type Mode = (typeof APPLY_MODES)[number][0];

const CLEARANCES = [['none', 'None required'], ['public_trust', 'Public Trust'], ['confidential', 'Confidential'], ['secret', 'Secret'], ['top_secret', 'Top Secret'], ['ts_sci', 'TS/SCI']];

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

/**
 * The job post form. If anything needs fixing, the message appears at the top and everything typed stays.
 * verifiedHost is the company's verified website (e.g. "acme.com"), used to check "apply on our site" links.
 */
export default function JobForm({ job, action, verifiedHost = null }: {
  job?: Job | null;
  action: (prev: JobFormState, fd: FormData) => Promise<JobFormState>;
  verifiedHost?: string | null;
}) {
  const [state, formAction] = useActionState(action, null);
  const [mode, setMode] = useState<Mode>((job?.apply_mode ?? (job?.apply_url ? 'both' : 'easy')) as Mode);
  const [url, setUrl] = useState(job?.apply_url ?? '');
  const [touched, setTouched] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const siteMode = mode !== 'easy';
  const linkProblem = siteMode && url.trim() ? applyLinkProblem(url, verifiedHost) : null;

  // Bring the problem into view when a save comes back with one.
  useEffect(() => { if (state?.error) errorRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && <div ref={errorRef} className="scroll-mt-24"><JobErrors error={state.error} /></div>}
      <section className="card grid gap-5 p-7 sm:grid-cols-2">
        <h2 className="font-serif text-2xl font-semibold sm:col-span-2">The role</h2>
        <Field label="Job title" wide><input name="title" required maxLength={140} defaultValue={job?.title} className="field" /></Field>
        <Field label="Department"><input name="department" defaultValue={job?.department ?? ''} className="field" /></Field>
        <Field label="Location"><input name="location" defaultValue={job?.location ?? ''} placeholder="City, ST — or several: Arlington, VA; San Diego, CA" className="field" />
          <label className="mt-2 flex items-center gap-2 text-xs text-muted"><input type="checkbox" name="multi_location" defaultChecked={!!(job as unknown as { multi_location?: boolean })?.multi_location} className="accent-navy" />Hiring in multiple locations</label></Field>
        <Field label="Work arrangement">
          <select name="work_arrangement" defaultValue={job?.work_arrangement ?? 'onsite'} className="field">
            <option value="onsite">On-site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option>
          </select>
        </Field>
        <Field label="Employment type">
          <select name="employment_type" defaultValue={job?.employment_type ?? 'full_time'} className="field">
            <option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="contract">Contract</option>
            <option value="internship">Internship</option><option value="skillbridge">SkillBridge</option>
          </select>
        </Field>
        <Field label="Experience level">
          <select name="experience_level" defaultValue={job?.experience_level ?? 'mid'} className="field">
            <option value="entry">Entry</option><option value="mid">Mid</option><option value="senior">Senior</option><option value="executive">Executive</option>
          </select>
        </Field>
        <Field label="Industry"><input name="industry" defaultValue={job?.industry ?? ''} className="field" /></Field>
        <fieldset className="space-y-3 sm:col-span-2">
          <legend className="field-label">How veterans apply</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {APPLY_MODES.map(([value, title, hint]) => (
              <label key={value} className="flex cursor-pointer gap-3 rounded-xl border border-line bg-white/60 p-4 transition-colors hover:border-brass has-[:checked]:border-navy has-[:checked]:bg-navy/[0.03] has-[:checked]:ring-1 has-[:checked]:ring-navy">
                <input type="radio" name="apply_mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1 accent-navy" />
                <span>
                  <span className="block text-sm font-semibold text-ink">{title}</span>
                  <span className="mt-0.5 block text-xs text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </div>
          {siteMode ? (
            <div className="rounded-xl border border-navy/15 bg-paper p-4">
              <label htmlFor="apply_url" className="field-label">Link to this job on your careers site</label>
              <input id="apply_url" name="apply_url" type="url" inputMode="url" required value={url}
                onChange={(e) => setUrl(e.target.value)} onBlur={() => setTouched(true)}
                aria-invalid={touched && !!linkProblem} aria-describedby="apply_url_help"
                placeholder={verifiedHost ? `https://careers.${verifiedHost}/jobs/123` : 'https://yourcompany.wd1.myworkdayjobs.com/…'} className="field" />
              {touched && linkProblem
                ? <p id="apply_url_help" role="alert" className="mt-1.5 text-xs text-signal">{linkProblem}</p>
                : <p id="apply_url_help" className="mt-1.5 text-xs text-muted">
                    {verifiedHost
                      ? <>Any page on <strong className="text-ink">{verifiedHost}</strong> works, or a standard applicant-tracking system (Workday, Greenhouse, Lever, iCIMS and similar).</>
                      : <>Use a standard applicant-tracking system link (Workday, Greenhouse, Lever, iCIMS and similar). Once your company website is verified, links on your own site work too.</>}
                    {' '}This protects veterans from look-alike phishing pages. Applicants open it in a new tab, and you’ll see the clicks in Hiring analytics.
                  </p>}
            </div>
          ) : (
            // Keep any link already saved, so switching back to "Your website" doesn't lose it.
            <input type="hidden" name="apply_url" value={url} />
          )}
        </fieldset>
        <div className="sm:col-span-2">
          <p className="field-label">Screening questions (optional, up to 5)</p>
          <p className="mb-2 text-xs text-muted">Applicants answer these when they Easy Apply{mode === 'external' ? ' — not used while applicants go to your website' : ' (not shown for website-only jobs)'}. Don’t ask about age, religion, disability, or other protected traits.</p>
          {[0, 1, 2, 3, 4].map((n) => {
            const q = ((job as unknown as { screening_questions?: { q: string; type: string }[] })?.screening_questions ?? [])[n];
            return (
              <div key={n} className="mb-2 flex flex-col gap-2 sm:flex-row">
                <input name={`question_${n}`} defaultValue={q?.q ?? ''} maxLength={200} placeholder={n === 0 ? 'e.g. Do you hold an active Secret clearance?' : 'Another question (optional)'} className="field text-sm" />
                <select name={`question_type_${n}`} defaultValue={q?.type ?? 'text'} className="field text-sm sm:w-40"><option value="text">Short answer</option><option value="yesno">Yes / No</option></select>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card grid gap-5 p-7 sm:grid-cols-3">
        <h2 className="font-serif text-2xl font-semibold sm:col-span-3">Compensation</h2>
        <Field label="Minimum"><input name="salary_min" inputMode="numeric" defaultValue={job?.salary_min ?? ''} placeholder="75000" className="field" /></Field>
        <Field label="Maximum"><input name="salary_max" inputMode="numeric" defaultValue={job?.salary_max ?? ''} placeholder="95000" className="field" /></Field>
        <Field label="Paid per">
          <select name="salary_period" defaultValue={job?.salary_period ?? 'year'} className="field"><option value="year">Year</option><option value="hour">Hour</option></select>
        </Field>
        <div className="sm:col-span-3"><label className="field-label" htmlFor="skillbridge_weeks">SkillBridge program length in weeks (SkillBridge only, up to 26)</label><input id="skillbridge_weeks" name="skillbridge_weeks" inputMode="numeric" defaultValue={(job as unknown as { skillbridge_weeks?: number | null })?.skillbridge_weeks ?? ''} className="field max-w-[200px]" /></div>
        <p className="text-xs text-muted sm:col-span-3">SkillBridge programs never list pay — DoD continues the member’s military pay and benefits, and companies may not pay participants.</p>
        <p className="text-xs text-muted sm:col-span-3">A salary range is required to publish. It’s required by law in several states, and veterans skip listings without pay.</p>
      </section>

      <section className="card grid gap-5 p-7">
        <h2 className="font-serif text-2xl font-semibold">Description</h2>
        <Field label="Overview"><textarea name="description" required rows={5} maxLength={8000} defaultValue={job?.description} className="field" /></Field>
        <Field label="Responsibilities (one per line)"><textarea name="responsibilities" rows={4} defaultValue={job?.responsibilities ?? ''} className="field" /></Field>
        <Field label="Qualifications (one per line)"><textarea name="qualifications" rows={4} defaultValue={job?.qualifications ?? ''} className="field" /></Field>
        <Field label="Preferred qualifications (one per line)"><textarea name="preferred_qualifications" rows={3} defaultValue={job?.preferred_qualifications ?? ''} className="field" /></Field>
        <Field label="Benefits"><textarea name="benefits" rows={2} defaultValue={job?.benefits ?? ''} className="field" /></Field>
      </section>

      <section className="card grid gap-5 p-7 sm:grid-cols-2">
        <h2 className="font-serif text-2xl font-semibold sm:col-span-2">Military-friendly details</h2>
        <label className="flex items-center gap-2.5 text-sm"><input type="checkbox" name="veteran_preferred" defaultChecked={job?.veteran_preferred ?? true} className="h-4 w-4 accent-navy" />Veteran preferred</label>
        <label className="flex items-center gap-2.5 text-sm"><input type="checkbox" name="military_transferable" defaultChecked={job?.military_transferable ?? true} className="h-4 w-4 accent-navy" />Military experience counts toward requirements</label>
        <Field label="Security clearance required">
          <select name="clearance_required" defaultValue={job?.clearance_required ?? 'none'} className="field">
            {CLEARANCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select name="polygraph_required" defaultValue={(job as unknown as { polygraph_required?: string })?.polygraph_required ?? 'none'} className="field mt-2" aria-label="Polygraph required"><option value="none">No polygraph required</option><option value="ci">CI polygraph required</option><option value="full_scope">Full-scope / lifestyle polygraph required</option></select>
        </Field>
        <label className="flex items-center gap-2.5 text-sm sm:pt-6"><input type="checkbox" name="clearance_eligible" defaultChecked={job?.clearance_eligible ?? false} className="h-4 w-4 accent-navy" />Will sponsor a clearance</label>
      </section>

      <section className="card space-y-3 p-7">
        <h2 className="font-serif text-2xl font-semibold">Who can see this job</h2>
        <p className="text-sm text-muted">Verified members always see the full job, your company and the application.</p>
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="public_listing" defaultChecked={(job as unknown as { public_listing?: boolean })?.public_listing ?? true} className="mt-0.5 h-4 w-4 accent-navy" />
          <span>Also list it publicly so it can appear in Google job search. <span className="text-muted">The public listing hides your company name, logo, website and any links, emails or phone numbers in the text. Only verified members can see who’s hiring and apply.</span></span>
        </label>
      </section>

      <label className="flex items-start gap-2 rounded-xl border border-line bg-paper p-3 text-xs text-ink/85">
        <input type="checkbox" name="attest" required className="mt-0.5 accent-navy" />
        I confirm this posting, its pay information, its screening questions, and how we classify the role (employee or contractor) comply with applicable law, and that the work won’t require sharing classified information or CUI on LanceNest.
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <select name="status" defaultValue={job?.status === 'draft' ? 'draft' : 'open'} className="field w-auto">
          <option value="open">Publish now</option><option value="draft">Save as draft</option>
        </select>
        <SubmitButton className="btn btn-primary" pendingText="Saving…">{job ? 'Save changes' : 'Post job'}</SubmitButton>
      </div>
    </form>
  );
}
