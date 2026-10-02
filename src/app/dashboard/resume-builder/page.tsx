import type { Metadata } from 'next';
import Link from 'next/link';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CLEARANCE_LABEL } from '@/lib/employer';
import PrintButton from '@/components/PrintButton';

export const metadata: Metadata = { title: 'Résumé builder', robots: { index: false } };
const yr = (d?: string | null) => (d ? new Date(`${d}T12:00:00`).getFullYear() : null);
const bullets = (text?: string | null) => (text ?? '').split(/\n+|(?<=\.)\s+(?=[A-Z])/).map((t) => t.replace(/^[-•*]\s*/, '').trim()).filter((t) => t.length > 3);

type Svc = { branch: string; rank: string | null; duty_title: string | null; unit: string | null; start_date: string | null; end_date: string | null; description: string | null; occupation_code: string | null;
  occupation: { title: string; civilian_categories: string[]; civilian_skills: string[] } | null };

export default async function ResumeBuilderPage() {
  const { user, profile } = await requireVerifiedMember('/dashboard/resume-builder');
  const supabase = createClient();
  const { data: vet } = await supabase.from('veteran_profiles').select('plan, about, clearance_level, city, state').eq('profile_id', user.id).maybeSingle();
  const allowed = ['pro', 'pro_plus', 'federal_pro'].includes((vet?.plan as string) ?? '');
  if (!allowed) {
    return (
      <div className="container-page max-w-2xl py-12 text-center">
        <p className="eyebrow">Pro Plus</p>
        <h1 className="mt-3 font-serif text-4xl font-medium">Military résumé builder</h1>
        <p className="mt-3 text-muted">Turn your military career into a clean civilian résumé in one click — your billets translated into civilian titles and skills, ready to save as a PDF.</p>
        <Link href="/plans" className="btn btn-primary mt-6">Upgrade to Pro Plus</Link>
      </div>
    );
  }
  const [{ data: service }, { data: exp }, { data: edu }, { data: skillRows }] = await Promise.all([
    supabase.from('military_service').select('*, occupation:military_occupations(title, civilian_categories, civilian_skills)').eq('profile_id', user.id).order('start_date', { ascending: false }),
    supabase.from('experience').select('company, position, start_date, end_date, description').eq('profile_id', user.id).order('start_date', { ascending: false }),
    supabase.from('education').select('*').eq('profile_id', user.id),
    supabase.from('profile_skills').select('skill:skills(name)').eq('profile_id', user.id),
  ]);
  const svc = (service ?? []) as unknown as Svc[];
  const skills = Array.from(new Set([...((skillRows ?? []) as unknown as { skill: { name: string } | null }[]).map((r) => r.skill?.name).filter(Boolean) as string[],
    ...svc.flatMap((s) => s.occupation?.civilian_skills ?? [])])).slice(0, 18);
  const location = [vet?.city, vet?.state].filter(Boolean).join(', ');

  return (
    <div className="container-page max-w-3xl py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div><Link href="/dashboard" className="text-sm text-muted hover:text-navy">← Dashboard</Link><h1 className="mt-2 font-serif text-3xl font-medium">Your civilian résumé</h1>
          <p className="text-sm text-muted">Built from your profile. Edit your profile to change it, then choose “Save as PDF” when printing. Upload the PDF under Résumés to apply with it.</p></div>
        <PrintButton />
      </div>
      <article className="bg-white p-8 text-[13px] leading-relaxed text-ink shadow-card print:p-0 print:shadow-none">
        <header className="border-b border-ink/20 pb-3">
          <h2 className="font-serif text-3xl">{profile.full_name}</h2>
          <p>{[profile.headline, location, user.email].filter(Boolean).join('  ·  ')}</p>
          {vet?.clearance_level && vet.clearance_level !== 'none' && <p className="font-semibold">Security clearance: {CLEARANCE_LABEL[vet.clearance_level as string]}</p>}
        </header>
        {vet?.about && <section className="mt-4"><h3 className="text-xs font-bold uppercase tracking-[0.15em]">Summary</h3><p className="mt-1">{vet.about as string}</p></section>}
        {(exp ?? []).length > 0 && (
          <section className="mt-4"><h3 className="text-xs font-bold uppercase tracking-[0.15em]">Professional experience</h3>
            {(exp ?? []).map((e, i) => (
              <div key={i} className="mt-2">
                <p><strong>{e.position as string}</strong>, {e.company as string} <span className="float-right">{yr(e.start_date as string) ?? ''}–{yr(e.end_date as string) ?? 'Present'}</span></p>
                <ul className="ml-5 list-disc">{bullets(e.description as string).map((b, j) => <li key={j}>{b}</li>)}</ul>
              </div>
            ))}
          </section>
        )}
        {svc.length > 0 && (
          <section className="mt-4"><h3 className="text-xs font-bold uppercase tracking-[0.15em]">Military experience</h3>
            {svc.map((s, i) => {
              const civilian = s.occupation?.civilian_categories?.[0];
              return (
                <div key={i} className="mt-2">
                  <p><strong>{s.duty_title || civilian || s.occupation?.title || s.branch}</strong>{civilian && s.duty_title ? ` (civilian equivalent: ${civilian})` : ''}, U.S. {s.branch}{s.unit ? ` — ${s.unit}` : ''}
                    <span className="float-right">{yr(s.start_date) ?? ''}–{yr(s.end_date) ?? 'Present'}</span></p>
                  <p className="text-ink/70">{[s.rank, s.occupation ? `${s.occupation_code ?? ''} ${s.occupation.title}`.trim() : null].filter(Boolean).join(' · ')}</p>
                  <ul className="ml-5 list-disc">
                    {bullets(s.description).map((b, j) => <li key={j}>{b}</li>)}
                    {!s.description && s.occupation?.civilian_skills?.length ? <li>Applied {s.occupation.civilian_skills.slice(0, 4).join(', ').toLowerCase()} in a high-accountability military environment.</li> : null}
                  </ul>
                </div>
              );
            })}
          </section>
        )}
        {(edu ?? []).length > 0 && (
          <section className="mt-4"><h3 className="text-xs font-bold uppercase tracking-[0.15em]">Education</h3>
            {(edu ?? []).map((e, i) => <p key={i}>{[(e as Record<string, unknown>).degree, (e as Record<string, unknown>).field, (e as Record<string, unknown>).school].filter(Boolean).join(', ')}{(e as Record<string, unknown>).graduation_year ? ` — ${(e as Record<string, unknown>).graduation_year}` : ''}</p>)}
          </section>
        )}
        {skills.length > 0 && <section className="mt-4"><h3 className="text-xs font-bold uppercase tracking-[0.15em]">Skills</h3><p className="mt-1">{skills.join(' · ')}</p></section>}
      </article>
    </div>
  );
}
