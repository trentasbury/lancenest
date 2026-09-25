import type { Job } from '@/lib/types';
import SubmitButton from '../SubmitButton';

const CLEARANCES = [['none', 'None required'], ['public_trust', 'Public Trust'], ['confidential', 'Confidential'], ['secret', 'Secret'], ['top_secret', 'Top Secret'], ['ts_sci', 'TS/SCI']];

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

export default function JobForm({ job, action }: { job?: Job | null; action: (fd: FormData) => Promise<void> }) {
  return (
    <form action={action} className="space-y-6">
      <section className="card grid gap-5 p-7 sm:grid-cols-2">
        <h2 className="font-serif text-2xl font-semibold sm:col-span-2">The role</h2>
        <Field label="Job title" wide><input name="title" required maxLength={140} defaultValue={job?.title} className="field" /></Field>
        <Field label="Department"><input name="department" defaultValue={job?.department ?? ''} className="field" /></Field>
        <Field label="Location"><input name="location" defaultValue={job?.location ?? ''} placeholder="City, State or Remote" className="field" /></Field>
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
      </section>

      <section className="card grid gap-5 p-7 sm:grid-cols-3">
        <h2 className="font-serif text-2xl font-semibold sm:col-span-3">Compensation</h2>
        <Field label="Minimum"><input name="salary_min" inputMode="numeric" defaultValue={job?.salary_min ?? ''} placeholder="75000" className="field" /></Field>
        <Field label="Maximum"><input name="salary_max" inputMode="numeric" defaultValue={job?.salary_max ?? ''} placeholder="95000" className="field" /></Field>
        <Field label="Paid per">
          <select name="salary_period" defaultValue={job?.salary_period ?? 'year'} className="field"><option value="year">Year</option><option value="hour">Hour</option></select>
        </Field>
        <p className="text-xs text-muted sm:col-span-3">Listings with a salary range get noticeably more applicants.</p>
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
        </Field>
        <label className="flex items-center gap-2.5 text-sm sm:pt-6"><input type="checkbox" name="clearance_eligible" defaultChecked={job?.clearance_eligible ?? false} className="h-4 w-4 accent-navy" />Will sponsor a clearance</label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <select name="status" defaultValue={job?.status === 'draft' ? 'draft' : 'open'} className="field w-auto">
          <option value="open">Publish now</option><option value="draft">Save as draft</option>
        </select>
        <SubmitButton className="btn btn-primary" pendingText="Saving…">{job ? 'Save changes' : 'Post job'}</SubmitButton>
      </div>
    </form>
  );
}
