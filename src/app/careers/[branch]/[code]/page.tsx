import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { branchFromSlug, publicDb } from '@/lib/careers';

export const revalidate = 86400;
type Occ = { id: string; code: string; branch: string; title: string; civilian_categories: string[] | null; civilian_skills: string[] | null };

async function load(branchSlug: string, code: string) {
  const branch = branchFromSlug(branchSlug);
  if (!branch) return null;
  const { data } = await publicDb().from('military_occupations').select('id, code, branch, title, civilian_categories, civilian_skills').eq('branch', branch).ilike('code', code).maybeSingle();
  return data as Occ | null;
}

export async function generateMetadata({ params }: { params: { branch: string; code: string } }): Promise<Metadata> {
  const o = await load(params.branch, params.code);
  if (!o) return { title: 'Military career translator' };
  const civ = (o.civilian_categories ?? []).slice(0, 3).join(', ');
  return {
    title: `${o.branch} ${o.code} ${o.title}: civilian careers & jobs`,
    description: `What an ${o.branch} ${o.code} (${o.title}) does in the civilian world${civ ? `: ${civ}` : ''}. Translated skills and jobs for verified service members on LanceNest.`,
    alternates: { canonical: `/careers/${params.branch}/${o.code.toLowerCase()}` },
  };
}

export default async function CareerPage({ params }: { params: { branch: string; code: string } }) {
  const o = await load(params.branch, params.code);
  if (!o) notFound();
  const cats = (o.civilian_categories ?? []).slice(0, 6);
  const skills = (o.civilian_skills ?? []).slice(0, 12);
  let openRoles = 0;
  if (cats.length) {
    const { count } = await createAdminClient().from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'open')
      .or(cats.slice(0, 3).map((c) => `title.ilike.%${c.replace(/[,()%]/g, ' ').trim()}%`).join(','));
    openRoles = count ?? 0;
  }
  return (
    <>
      <section className="bg-navy-deep text-ivory"><div className="container-page py-14">
        <Link href="/careers" className="text-sm text-cream/70 hover:text-brass">← All military careers</Link>
        <p className="eyebrow mt-4 text-brass">{o.branch} · {o.code}</p>
        <h1 className="mt-2 font-serif text-4xl font-medium text-ivory sm:text-5xl">{o.title}: civilian careers</h1>
        <p className="mt-3 max-w-2xl text-cream/80">How your experience as {/^[aeiou]/i.test(o.title) ? 'an' : 'a'} {o.title} translates to the civilian workforce — and the verified employers hiring for it.</p>
      </div></section>
      <div className="container-page grid gap-8 py-12 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {cats.length > 0 && <section className="card p-7"><h2 className="eyebrow">Civilian career paths</h2><ul className="mt-4 grid gap-2 sm:grid-cols-2">{cats.map((c) => <li key={c} className="rounded-[4px] border border-line bg-paper px-4 py-3 font-medium text-navy">{c}</li>)}</ul></section>}
          {skills.length > 0 && <section className="card p-7"><h2 className="eyebrow">Skills employers recognize</h2><div className="mt-4 flex flex-wrap gap-2">{skills.map((s) => <span key={s} className="pill">{s}</span>)}</div></section>}
          <section className="card p-7">
            <h2 className="eyebrow">Your whole career counts</h2>
            <p className="mt-3 text-ink/85">Your military job is a starting point, not a box. On LanceNest, jobs are matched to your entire background — civilian roles, skills, certifications, and the work you want next. Your military experience counts most while you’re serving or recently out.</p>
          </section>
        </div>
        <aside className="space-y-4">
          <div className="card p-6">
            {openRoles > 0 && <p className="font-serif text-3xl text-navy">{openRoles} <span className="text-base text-muted">open role{openRoles === 1 ? '' : 's'} match this career</span></p>}
            <p className="mt-2 text-sm text-muted">Verified employers, cleared roles, SkillBridge, and freelance work — for service members and veterans only.</p>
            <Link href="/signup?role=veteran" className="btn btn-primary mt-4 w-full">Join free & see matching jobs</Link>
          </div>
          <div className="card p-6"><p className="eyebrow">Hiring?</p><p className="mt-2 text-sm text-muted">Hire verified service members and veterans with this experience.</p><Link href="/employers" className="btn btn-outline mt-3 w-full">Hire people with this experience</Link></div>
          <div className="card p-5 text-sm"><p className="eyebrow">Guides</p><ul className="mt-2 space-y-1"><li><Link href="/guides/translate-military-experience-resume" className="text-navy underline">Translate your experience for a résumé</Link></li><li><Link href="/guides/how-to-use-dod-skillbridge" className="text-navy underline">How to use SkillBridge</Link></li><li><Link href="/guides/gi-bill-vs-certifications" className="text-navy underline">GI Bill vs. certifications</Link></li></ul></div>
          <p className="text-xs text-muted">Translations are general guidance. LanceNest is not affiliated with the Department of Defense or any military branch.</p>
        </aside>
      </div>
    </>
  );
}
