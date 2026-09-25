import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import VerificationBadge from '@/components/VerificationBadge';
import { CLEARANCES, COMPONENTS, yearOf } from '@/lib/military';
import { initials } from '@/lib/format';

type Profile = { id: string; full_name: string; username: string; headline: string | null; location: string | null; avatar_url: string | null };
type Vet = { about: string | null; clearance_level: string; verification_status: string; willing_to_relocate: boolean };
type Service = {
  id: string; branch: string; component: string; rank: string | null; occupation_code: string | null;
  start_date: string | null; end_date: string | null; deployments: number;
  occupation: { title: string; civilian_categories: string[]; civilian_skills: string[] } | null;
};

async function load(username: string) {
  const supabase = createClient();
  // Row-level security decides visibility: the owner, employers, admins, or anyone if the profile is public.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, username, headline, location, avatar_url')
    .eq('username', username)
    .eq('role', 'veteran')
    .maybeSingle();
  if (!profile) return null;

  const { data: vet } = await supabase
    .from('veteran_profiles')
    .select('about, clearance_level, verification_status, willing_to_relocate')
    .eq('profile_id', profile.id)
    .maybeSingle();
  if (!vet) return null;

  return { supabase, profile: profile as Profile, vet: vet as Vet };
}

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const data = await load(params.username);
  if (!data) return { title: 'Profile not found', robots: { index: false } };
  return {
    title: data.profile.full_name,
    description: data.profile.headline ?? `${data.profile.full_name} on LanceNest`,
  };
}

export default async function VeteranProfilePage({ params }: { params: { username: string } }) {
  const data = await load(params.username);
  if (!data) notFound();
  const { supabase, profile, vet } = data;

  const [{ data: service }, { data: skillRows }, { data: experience }, { data: education }, session] = await Promise.all([
    supabase.from('military_service').select('*, occupation:military_occupations(title, civilian_categories, civilian_skills)').eq('profile_id', profile.id).order('start_date', { ascending: false }),
    supabase.from('profile_skills').select('skill:skills(name)').eq('profile_id', profile.id),
    supabase.from('experience').select('*').eq('profile_id', profile.id).order('start_date', { ascending: false }),
    supabase.from('education').select('*').eq('profile_id', profile.id).order('graduation_year', { ascending: false }),
    getSessionProfile(),
  ]);

  const services = (service ?? []) as unknown as Service[];
  const skills = ((skillRows ?? []) as unknown as { skill: { name: string } | null }[]).map((r) => r.skill?.name).filter(Boolean) as string[];
  const isOwner = session?.user.id === profile.id;
  const primary = services[0];
  const translated = Array.from(new Set(services.flatMap((s) => s.occupation?.civilian_categories ?? []))).slice(0, 8);
  const clearance = CLEARANCES.find(([v]) => v === vet.clearance_level)?.[1];

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page flex flex-col gap-6 py-12 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-brass bg-navy font-serif text-3xl text-brass">
            {initials(profile.full_name)}
          </div>
          <div className="flex-1">
            <h1 className="font-serif text-4xl font-medium text-ivory sm:text-5xl">{profile.full_name}</h1>
            {profile.headline && <p className="mt-1 text-lg text-cream/85">{profile.headline}</p>}
            <p className="mt-2 text-sm text-cream/70">
              {[primary ? `${primary.branch}${primary.rank ? ` · ${primary.rank}` : ''}` : null, profile.location, vet.willing_to_relocate ? 'Open to relocation' : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <VerificationBadge status={vet.verification_status} />
              {clearance && vet.clearance_level !== 'none' && (
                <span className="inline-flex items-center rounded-full border border-brass/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brass">
                  {clearance} clearance
                </span>
              )}
            </div>
          </div>
          {isOwner && <Link href="/dashboard/profile" className="btn btn-brass shrink-0">Edit profile</Link>}
        </div>
      </section>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          {vet.about && (
            <section className="card p-7">
              <h2 className="eyebrow">About</h2>
              <p className="mt-3 whitespace-pre-line text-[16px] leading-relaxed text-ink/90">{vet.about}</p>
            </section>
          )}

          <section className="card p-7">
            <h2 className="eyebrow">Military service</h2>
            {services.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No service history added yet.</p>
            ) : (
              <ul className="mt-4 space-y-5">
                {services.map((s) => (
                  <li key={s.id} className="border-l-2 border-brass pl-4">
                    <p className="font-serif text-xl font-semibold">
                      {s.occupation?.title ?? s.occupation_code ?? s.branch}
                      {s.occupation_code && s.occupation && <span className="font-sans text-sm font-normal text-muted"> · {s.occupation_code}</span>}
                    </p>
                    <p className="text-sm text-muted">
                      {s.branch}{s.rank ? ` · ${s.rank}` : ''} · {COMPONENTS.find(([v]) => v === s.component)?.[1]} · {yearOf(s.start_date) || '—'}–{yearOf(s.end_date) || 'Present'}
                      {s.deployments > 0 && ` · ${s.deployments} deployment${s.deployments > 1 ? 's' : ''}`}
                    </p>
                    {s.occupation && s.occupation.civilian_skills.length > 0 && (
                      <p className="mt-2 text-sm text-navy">{s.occupation.civilian_skills.join(' · ')}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(experience ?? []).length > 0 && (
            <section className="card p-7">
              <h2 className="eyebrow">Civilian experience</h2>
              <ul className="mt-4 space-y-5">
                {(experience ?? []).map((e: { id: string; company: string; position: string; start_date: string | null; end_date: string | null; description: string | null }) => (
                  <li key={e.id}>
                    <p className="font-serif text-xl font-semibold">{e.position}</p>
                    <p className="text-sm text-muted">{e.company} · {yearOf(e.start_date) || '—'}–{yearOf(e.end_date) || 'Present'}</p>
                    {e.description && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink/85">{e.description}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(education ?? []).length > 0 && (
            <section className="card p-7">
              <h2 className="eyebrow">Education</h2>
              <ul className="mt-4 space-y-3">
                {(education ?? []).map((e: { id: string; school: string; degree: string | null; field: string | null; graduation_year: number | null }) => (
                  <li key={e.id}>
                    <p className="font-medium">{e.school}</p>
                    <p className="text-sm text-muted">{[e.degree, e.field].filter(Boolean).join(', ')}{e.graduation_year ? ` · ${e.graduation_year}` : ''}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          {translated.length > 0 && (
            <div className="card border-brass/40 p-6">
              <p className="eyebrow">Civilian roles this service translates to</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {translated.map((c) => <span key={c} className="pill border-brass/40 bg-brass/10">{c}</span>)}
              </div>
            </div>
          )}
          <div className="card p-6">
            <p className="eyebrow">Skills</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {skills.length === 0 ? <p className="text-sm text-muted">No skills listed yet.</p> : skills.map((s) => <span key={s} className="pill">{s}</span>)}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
