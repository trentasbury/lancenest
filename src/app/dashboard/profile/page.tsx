import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import ProfileEditor from '@/components/ProfileEditor';
import AvatarUpload from '@/components/AvatarUpload';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { BRANCHES, CLEARANCES, COMPONENTS, yearOf } from '@/lib/military';
import { VISIBILITY } from '@/lib/network';
import { shareProfileMilestone } from '@/app/network/actions';
import {
  addEducation, addExperience, addService, addSkill, removeEducation, removeExperience,
  removeResume, removeService, removeSkill, saveBasics, setDefaultResume, uploadResume,
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
  resume_missing: 'Choose a file to upload.',
  resume_size: 'Résumés must be under 4 MB.',
  resume_type: 'Upload a PDF or Word document (.pdf, .doc, .docx).',
  resume_limit: 'You can keep up to 3 résumés. Remove one to add another.',
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

export default async function EditProfilePage({ searchParams }: { searchParams: { saved?: string; error?: string; share?: string; photo?: string } }) {
  const { user, profile } = await requireRole(['veteran', 'admin'], '/dashboard/profile');
  if (profile.role === 'admin') await createAdminClient().from('veteran_profiles').upsert({ profile_id: user.id }, { onConflict: 'profile_id', ignoreDuplicates: true });
  const supabase = createClient();

  const { data: resumes } = await supabase.from('resumes').select('id, file_name, uploaded_at, is_default').eq('profile_id', user.id).order('uploaded_at', { ascending: false });
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
  const [shareKindRaw, shareId] = (searchParams.share ?? '').split(':');
  const shareKind = (['experience', 'education', 'service'] as const).find((k) => k === shareKindRaw);

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
        <section className="card flex flex-wrap items-center gap-5 p-6">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="h-20 w-20 rounded-full border-2 border-brass object-cover" />
          ) : <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-brass bg-navy font-serif text-2xl text-brass">{(profile.full_name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>}
          <div>
            <p className="eyebrow">Profile photo</p>
            <p className="mb-2 text-xs text-muted">A clear, professional headshot. Avoid unit insignia, locations, or equipment.</p>
            <AvatarUpload back="/dashboard/profile" />
            {searchParams.photo && <p className={`mt-2 text-sm ${searchParams.photo === 'saved' ? 'text-olive' : 'text-signal'}`}>{searchParams.photo === 'saved' ? 'Photo updated.' : 'That photo didn’t upload — please try another.'}</p>}
          </div>
        </section>
        {error && <FormMessage error={error} />}
        {searchParams.saved && !error && !searchParams.share && <FormMessage message="Saved." />}
        {shareKind && shareId && (
          <div id="share" className="card scroll-mt-24 border-brass p-6">
            <p className="eyebrow">Saved — share this with your network?</p>
            <p className="mt-2 font-serif text-xl text-navy">
              {shareKind === 'experience' ? 'Let your network know about your new position.' : shareKind === 'education' ? 'Let your network celebrate your education milestone.' : 'Let your network recognize your service.'}
            </p>
            <p className="mt-1 text-sm text-muted">Nothing is posted unless you choose to. You can add a note and pick who sees it.</p>
            <form action={shareProfileMilestone.bind(null, shareKind, shareId)} className="mt-4 space-y-3">
              <textarea name="body" rows={2} maxLength={3000} placeholder="Add a note (optional)" className="field" />
              <div className="flex flex-wrap items-center gap-3">
                <select name="visibility" defaultValue="network" className="field w-auto">
                  {VISIBILITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <SubmitButton className="btn btn-primary" pendingText="Sharing…">Share to my network</SubmitButton>
                <Link href="/dashboard/profile" className="btn btn-ghost">Not now</Link>
              </div>
            </form>
          </div>
        )}

        <Section id="resume" title="Résumés" hint="Keep up to 3 (for example, one per career path). You choose which to send each time you apply, and only that company sees it — never other members.">
          {(resumes ?? []).length > 0 ? (
            <ul className="mb-5 divide-y divide-line rounded-[4px] border border-line bg-paper">
              {(resumes ?? []).map((r) => (
                <li key={r.id as string} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{r.file_name as string}{r.is_default && <span className="ml-2 rounded-full bg-olive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-olive">Default</span>}</p>
                    <p className="text-xs text-muted">Uploaded {new Date(r.uploaded_at as string).toLocaleDateString('en-US', { dateStyle: 'medium' })}</p>
                  </div>
                  <div className="flex gap-2">
                    <a href={`/api/resume-files/${r.id}`} className="btn btn-ghost border border-line py-1.5 text-xs">Download</a>
                    {!r.is_default && <form action={setDefaultResume.bind(null, r.id as string)}><button className="btn btn-ghost py-1.5 text-xs">Make default</button></form>}
                    <form action={removeResume.bind(null, r.id as string)}><button className="btn btn-ghost py-1.5 text-xs text-signal">Remove</button></form>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="mb-5 text-sm text-muted">No résumé yet. Applications with a résumé get far more responses.</p>}
          {(resumes ?? []).length < 3 && (
            <form action={uploadResume} className="space-y-3">
              <div>
                <label htmlFor="resume-file" className="field-label">Add a résumé (PDF or Word, up to 4 MB)</label>
                <input id="resume-file" name="resume" type="file" required accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="field text-sm file:mr-3 file:rounded-[3px] file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-ivory" />
              </div>
              {(resumes ?? []).length > 0 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="make_default" className="accent-navy" />Make this my default</label>}
              <p className="text-xs text-signal">Before uploading: remove your Social Security number, DoD ID number, date of birth, home address, and any clearance investigation details. A phone number and email are enough.</p>
              <SubmitButton className="btn btn-primary" pendingText="Uploading…">Upload</SubmitButton>
            </form>
          )}
        </Section>

        <ProfileEditor initial={{
          basics: { full_name: profile.full_name ?? '', headline: profile.headline ?? '', city: (vet?.city as string) ?? '', state: (vet?.state as string) ?? '', about: (vet?.about as string) ?? '',
            clearance_level: (vet?.clearance_level as string) ?? 'none', clearance_status: ((vet as Record<string, unknown> | null)?.clearance_status as string) ?? '', polygraph: ((vet as Record<string, unknown> | null)?.polygraph as string) ?? 'none', willing_to_relocate: !!vet?.willing_to_relocate, is_public: vet?.is_public !== false, desired_titles: ((vet?.desired_titles as string[] | null) ?? []).join(', ') },
          service: services.map((x) => ({ id: x.id, branch: x.branch, component: (x as unknown as { component?: string }).component ?? 'active', rank: x.rank ?? '', duty_title: (x as unknown as { duty_title?: string }).duty_title ?? '', unit: (x as unknown as { unit?: string }).unit ?? '', occupation_code: x.occupation_code ?? '', start_year: x.start_date ? String(new Date(`${x.start_date}T12:00:00`).getFullYear()) : '', end_year: x.end_date ? String(new Date(`${x.end_date}T12:00:00`).getFullYear()) : '', description: (x as unknown as { description?: string }).description ?? '', deployments: String((x as unknown as { deployments?: number }).deployments ?? '') })),
          experience: exps.map((x) => ({ id: x.id, company: x.company ?? '', position: x.position ?? '', start_year: x.start_date ? String(new Date(`${x.start_date}T12:00:00`).getFullYear()) : '', end_year: x.end_date ? String(new Date(`${x.end_date}T12:00:00`).getFullYear()) : '', description: x.description ?? '' })),
          education: edus.map((x) => ({ id: x.id, school: x.school ?? '', degree: x.degree ?? '', field: x.field ?? '', graduation_year: x.graduation_year ? String(x.graduation_year) : '' })),
          skills: skills.map((k) => k.name),
        }} />

      </div>
    </>
  );
}
