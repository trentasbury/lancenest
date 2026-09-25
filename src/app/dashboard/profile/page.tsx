import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { BRANCHES, CLEARANCES, COMPONENTS, yearOf } from '@/lib/military';
import {
  addEducation, addExperience, addService, addSkill, removeEducation, removeExperience,
  removeService, removeSkill, saveBasics,
} from './actions';

export const metadata: Metadata = { title: 'Edit profile' };

const ERRORS: Record<string, string> = {
  name: 'Your name can’t be empty.',
  skill: 'Type a skill before adding it.',
  branch: 'Choose a branch of service.',
  years: 'The end year can’t be before the start year.',
  experience: 'Company and position are both required.',
  school: 'Enter the school name.',
  save: 'Something went wrong saving that. Please try again.',
};

type Service = { id: string; branch: string; component: string; rank: string | null; occupation_code: string | null; start_date: string | null; end_date: string | null; deployments: number; occupation: { title: string } | null };
type Exp = { id: string; company: string; position: string; start_date: string | null; end_date: string | null; description: string | null };
type Edu = { id: string; school: string; degree: string | null; field: string | null; graduation_year: number | null };

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-24 p-6 sm:p-8">
      <h2 className="font-serif text-2xl font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function RemoveButton({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action}>
      <button type="submit" className="text-xs text-muted underline-offset-4 hover:text-signal hover:underline">Remove</button>
    </form>
  );
}

export default async function EditProfilePage({ searchParams }: { searchParams: { saved?: string; error?: string } }) {
  const { user, profile } = await requireRole(['veteran'], '/dashboard/profile');
  const supabase = createClient();

  const [{ data: vet }, { data: skillRows }, { data: service }, { data: experience }, { data: education }] = await Promise.all([
    supabase.from('veteran_profiles').select('*').eq('profile_id', user.id).maybeSingle(),
    supabase.from('profile_skills').select('skill:skills(id, name)').eq('profile_id', user.id),
    supabase.from('military_service').select('*, occupation:military_occupations(title)').eq('profile_id', user.id).order('start_date', { ascending: false }),
    supabase.from('experience').select('*').eq('profile_id', user.id).order('start_date', { ascending: false }),
    supabase.from('education').select('*').eq('profile_id', user.id).order('graduation_year', { ascending: false }),
  ]);

  const skills = ((skillRows ?? []) as unknown as { skill: { id: string; name: string } | null }[])
    .map((r) => r.skill)
    .filter((s): s is { id: string; name: string } => !!s);
  const services = (service ?? []) as unknown as Service[];
  const exps = (experience ?? []) as Exp[];
  const edus = (education ?? []) as Edu[];
  const error = searchParams.error ? ERRORS[searchParams.error] ?? ERRORS.save : undefined;

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page flex flex-col gap-4 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-cream/70 hover:text-brass">← Dashboard</Link>
            <h1 className="mt-3 font-serif text-4xl font-medium text-ivory">Your profile</h1>
            <p className="mt-1 text-cream/75">This is what employers see. Your service is the headline — tell them what you did.</p>
          </div>
          {profile.username && (
            <Link href={`/veterans/${profile.username}`} className="btn btn-brass shrink-0">View public profile →</Link>
          )}
        </div>
      </section>

      <div className="container-page max-w-3xl space-y-6 py-10">
        {error && <FormMessage error={error} />}
        {searchParams.saved && !error && <FormMessage message="Saved." />}

        <Section id="basics" title="About you">
          <form action={saveBasics} className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="full_name" className="field-label">Full name</label>
              <input id="full_name" name="full_name" defaultValue={profile.full_name} required className="field" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="headline" className="field-label">Headline</label>
              <input id="headline" name="headline" defaultValue={profile.headline ?? ''} maxLength={140} placeholder="e.g. Marine veteran · Operations & security leader" className="field" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="about" className="field-label">About me</label>
              <textarea id="about" name="about" rows={6} maxLength={3000} defaultValue={vet?.about ?? ''} placeholder="Where you served, what you led, and what you want to do next." className="field" />
            </div>
            <div>
              <label htmlFor="city" className="field-label">City</label>
              <input id="city" name="city" defaultValue={vet?.city ?? ''} className="field" />
            </div>
            <div>
              <label htmlFor="state" className="field-label">State</label>
              <input id="state" name="state" defaultValue={vet?.state ?? ''} placeholder="FL" className="field" />
            </div>
            <div>
              <label htmlFor="clearance_level" className="field-label">Security clearance</label>
              <select id="clearance_level" name="clearance_level" defaultValue={vet?.clearance_level ?? 'none'} className="field">
                {CLEARANCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <p className="mt-1.5 text-xs text-muted">Level only. Never enter investigation or case details.</p>
            </div>
            <div className="flex flex-col justify-center gap-3 sm:pt-5">
              <label className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" name="willing_to_relocate" defaultChecked={vet?.willing_to_relocate ?? false} className="h-4 w-4 accent-navy" />
                Open to relocating
              </label>
              <label className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" name="is_public" defaultChecked={vet?.is_public ?? false} className="h-4 w-4 accent-navy" />
                Make my profile public
              </label>
            </div>
            <p className="text-xs text-muted sm:col-span-2">
              Employers on LanceNest can always see your profile. “Public” also lets anyone with the link see it, without an account.
            </p>
            <div className="sm:col-span-2"><SubmitButton className="btn btn-primary" pendingText="Saving…">Save</SubmitButton></div>
          </form>
        </Section>

        <Section id="service" title="Military service" hint="Add your MOS, rating, or AFSC — we translate it into civilian language on your profile.">
          {services.length > 0 && (
            <ul className="mb-6 divide-y divide-line rounded-[4px] border border-line bg-paper">
              {services.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium text-ink">
                      {s.branch}{s.rank ? ` · ${s.rank}` : ''}{s.occupation_code ? ` · ${s.occupation_code}` : ''}{s.occupation ? ` ${s.occupation.title}` : ''}
                    </p>
                    <p className="text-sm text-muted">
                      {COMPONENTS.find(([v]) => v === s.component)?.[1]} · {yearOf(s.start_date) || '—'}–{yearOf(s.end_date) || 'Present'}
                      {s.deployments > 0 && ` · ${s.deployments} deployment${s.deployments > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <RemoveButton action={removeService.bind(null, s.id)} />
                </li>
              ))}
            </ul>
          )}
          <form action={addService} className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="branch" className="field-label">Branch</label>
              <select id="branch" name="branch" required defaultValue="" className="field">
                <option value="" disabled>Choose…</option>
                {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="component" className="field-label">Component</label>
              <select id="component" name="component" defaultValue="active" className="field">
                {COMPONENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="rank" className="field-label">Rank</label>
              <input id="rank" name="rank" placeholder="e.g. Sgt, E-5" className="field" />
            </div>
            <div>
              <label htmlFor="occupation_code" className="field-label">MOS / rating / AFSC</label>
              <input id="occupation_code" name="occupation_code" placeholder="e.g. 0311" className="field" />
            </div>
            <div>
              <label htmlFor="start_year" className="field-label">Start year</label>
              <input id="start_year" name="start_year" type="number" min={1950} max={2100} placeholder="2017" className="field" />
            </div>
            <div>
              <label htmlFor="end_year" className="field-label">End year</label>
              <input id="end_year" name="end_year" type="number" min={1950} max={2100} placeholder="Blank if serving" className="field" />
            </div>
            <div>
              <label htmlFor="deployments" className="field-label">Deployments</label>
              <input id="deployments" name="deployments" type="number" min={0} max={50} defaultValue={0} className="field" />
            </div>
            <div className="flex items-end sm:col-span-2"><SubmitButton className="btn btn-outline" pendingText="Adding…">Add service</SubmitButton></div>
          </form>
        </Section>

        <Section id="skills" title="Skills">
          <div className="mb-5 flex flex-wrap gap-2">
            {skills.length === 0 && <p className="text-sm text-muted">No skills yet — add the ones you want employers to search for.</p>}
            {skills.map((s) => (
              <span key={s.id} className="pill gap-2">
                {s.name}
                <form action={removeSkill.bind(null, s.id)} className="inline">
                  <button type="submit" aria-label={`Remove ${s.name}`} className="text-muted hover:text-signal">×</button>
                </form>
              </span>
            ))}
          </div>
          <form action={addSkill} className="flex gap-2">
            <label htmlFor="skill" className="sr-only">Skill</label>
            <input id="skill" name="skill" placeholder="e.g. Logistics, Team leadership, ServiceNow" className="field" />
            <SubmitButton className="btn btn-outline shrink-0" pendingText="Adding…">Add</SubmitButton>
          </form>
        </Section>

        <Section id="experience" title="Civilian experience">
          {exps.length > 0 && (
            <ul className="mb-6 divide-y divide-line rounded-[4px] border border-line bg-paper">
              {exps.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium text-ink">{e.position} · {e.company}</p>
                    <p className="text-sm text-muted">{yearOf(e.start_date) || '—'}–{yearOf(e.end_date) || 'Present'}</p>
                    {e.description && <p className="mt-1.5 whitespace-pre-line text-sm text-ink/80">{e.description}</p>}
                  </div>
                  <RemoveButton action={removeExperience.bind(null, e.id)} />
                </li>
              ))}
            </ul>
          )}
          <form action={addExperience} className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="position" className="field-label">Position</label><input id="position" name="position" required className="field" /></div>
            <div><label htmlFor="company" className="field-label">Company</label><input id="company" name="company" required className="field" /></div>
            <div><label htmlFor="exp_start" className="field-label">Start year</label><input id="exp_start" name="start_year" type="number" min={1950} max={2100} className="field" /></div>
            <div><label htmlFor="exp_end" className="field-label">End year</label><input id="exp_end" name="end_year" type="number" min={1950} max={2100} placeholder="Blank if current" className="field" /></div>
            <div className="sm:col-span-2"><label htmlFor="description" className="field-label">What you did</label><textarea id="description" name="description" rows={3} maxLength={2000} className="field" /></div>
            <div className="sm:col-span-2"><SubmitButton className="btn btn-outline" pendingText="Adding…">Add experience</SubmitButton></div>
          </form>
        </Section>

        <Section id="education" title="Education">
          {edus.length > 0 && (
            <ul className="mb-6 divide-y divide-line rounded-[4px] border border-line bg-paper">
              {edus.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium text-ink">{e.school}</p>
                    <p className="text-sm text-muted">{[e.degree, e.field].filter(Boolean).join(', ')}{e.graduation_year ? ` · ${e.graduation_year}` : ''}</p>
                  </div>
                  <RemoveButton action={removeEducation.bind(null, e.id)} />
                </li>
              ))}
            </ul>
          )}
          <form action={addEducation} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label htmlFor="school" className="field-label">School</label><input id="school" name="school" required className="field" /></div>
            <div><label htmlFor="degree" className="field-label">Degree</label><input id="degree" name="degree" placeholder="e.g. B.S." className="field" /></div>
            <div><label htmlFor="field" className="field-label">Field of study</label><input id="field" name="field" className="field" /></div>
            <div><label htmlFor="graduation_year" className="field-label">Graduation year</label><input id="graduation_year" name="graduation_year" type="number" min={1950} max={2100} className="field" /></div>
            <div className="flex items-end"><SubmitButton className="btn btn-outline" pendingText="Adding…">Add education</SubmitButton></div>
          </form>
        </Section>
      </div>
    </>
  );
}
