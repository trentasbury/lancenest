import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { FORMAT_LABEL, TRAINING_CATEGORIES } from '@/lib/training';
import { OFFICIAL } from '@/lib/transition';

export const metadata: Metadata = { title: 'Training & Certifications' };
type Program = { id: string; title: string; category: string; description: string; format: string; location: string | null; duration: string | null; cost: string | null;
  gi_bill_approved: boolean; url: string; company: { name: string; slug: string; training_featured: boolean } | null };

export default async function TrainingPage({ searchParams }: { searchParams: { category?: string } }) {
  const supabase = createClient();
  let q = supabase.from('training_programs').select('id, title, category, description, format, location, duration, cost, gi_bill_approved, url, company:companies(name, slug, training_featured)').eq('status', 'live');
  const category = TRAINING_CATEGORIES.includes(searchParams.category ?? '') ? searchParams.category! : null;
  if (category) q = q.eq('category', category);
  const [{ data }, { data: events }] = await Promise.all([
    q.order('created_at', { ascending: false }).limit(100),
    supabase.from('training_events').select('title, starts_at, url, company:companies(name)').gte('starts_at', new Date().toISOString()).order('starts_at').limit(6),
  ]);
  // Featured partners first (paid placement), newest first within each group.
  const programs = ((data ?? []) as unknown as Program[]).sort((a, b) => Number(!!b.company?.training_featured) - Number(!!a.company?.training_featured));

  return (
    <>
      <section className="bg-navy-deep text-ivory"><div className="container-page py-10">
        <p className="eyebrow text-brass">Training & Certifications</p>
        <h1 className="mt-2 font-serif text-4xl font-medium text-ivory sm:text-5xl">Earn the credential for your next role.</h1>
        <p className="mt-2 max-w-2xl text-cream/80">Programs from verified training providers — cybersecurity, IT, trades, healthcare, and more.</p>
      </div></section>
      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Link href="/training" className={`rounded-full border px-3 py-1 text-sm ${!category ? 'border-navy bg-navy text-ivory' : 'border-line'}`}>All</Link>
            {TRAINING_CATEGORIES.map((c) => <Link key={c} href={`/training?category=${encodeURIComponent(c)}`} className={`rounded-full border px-3 py-1 text-sm ${category === c ? 'border-navy bg-navy text-ivory' : 'border-line hover:border-brass'}`}>{c}</Link>)}
          </div>
          {programs.length === 0 ? <p className="card p-8 text-center text-muted">No programs listed here yet — training partners are being onboarded.</p> : programs.map((p) => (
            <article key={p.id} className={`card p-5 ${p.company?.training_featured ? 'border-brass' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-xl text-navy">{p.title}{p.company?.training_featured && <span className="ml-2 rounded-full bg-brass px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-[0.1em] text-navy">Featured</span>}</p>
                  <p className="text-sm text-muted">{p.company?.name} · {p.category} · {FORMAT_LABEL[p.format]}{p.location ? ` · ${p.location}` : ''}{p.duration ? ` · ${p.duration}` : ''}</p>
                </div>
                {p.cost && <p className="text-sm font-medium">{p.cost}</p>}
              </div>
              <p className="mt-2 text-sm text-ink/85">{p.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary py-2 text-sm">View program ↗</a>
                {p.gi_bill_approved && <span className="text-xs text-olive">GI Bill approved (per provider) — <a href={OFFICIAL.giBill} target="_blank" rel="noopener noreferrer" className="underline">confirm with VA</a></span>}
              </div>
            </article>
          ))}
        </div>
        <aside className="space-y-4">
          <div className="card p-5">
            <p className="eyebrow">Upcoming info sessions</p>
            {(events ?? []).length === 0 ? <p className="mt-2 text-sm text-muted">None scheduled right now.</p> : (
              <ul className="mt-3 space-y-3 text-sm">{((events ?? []) as unknown as { title: string; starts_at: string; url: string; company: { name: string } | null }[]).map((e, i) => (
                <li key={i}><a href={e.url} target="_blank" rel="noopener noreferrer" className="font-medium text-navy hover:underline">{e.title}</a><span className="block text-xs text-muted">{e.company?.name} · {new Date(e.starts_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span></li>
              ))}</ul>
            )}
          </div>
          <p className="text-xs text-muted">Providers pay a flat fee to list programs; LanceNest never earns per enrollment and doesn’t endorse any program. Always confirm GI Bill approval with the VA.</p>
        </aside>
      </div>
    </>
  );
}
