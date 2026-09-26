import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ensureOccupationsLoaded } from '@/lib/occupations';
import { sanitizeSearch } from '@/lib/format';
import type { MilitaryOccupation } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Translate Your Military Occupation',
  description: 'See the civilian careers and skills your MOS, rating, or AFSC prepares you for.',
};

const BRANCH_LIST = ['Army', 'Marine Corps', 'Navy', 'Air Force', 'Coast Guard'];

export default async function ResourcesPage({ searchParams }: { searchParams: { code?: string; branch?: string } }) {
  await ensureOccupationsLoaded();
  const supabase = createClient();
  const branch = BRANCH_LIST.includes(searchParams.branch ?? '') ? searchParams.branch! : null;
  const code = sanitizeSearch(searchParams.code ?? '');

  const [{ data: matches }, { data: directory }] = await Promise.all([
    code
      ? supabase.from('military_occupations').select('*').or(`code.ilike.${code},title.ilike.%${code}%`).order('branch').limit(20)
      : Promise.resolve({ data: [] as MilitaryOccupation[] }),
    branch
      ? supabase.from('military_occupations').select('code, branch, title, description').eq('branch', branch).order('description').order('code').limit(1000)
      : Promise.resolve({ data: [] as { code: string; branch: string; title: string; description: string | null }[] }),
  ]);

  const results = (matches ?? []) as MilitaryOccupation[];

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page py-14">
          <p className="eyebrow text-brass">Career Resources</p>
          <h1 className="mt-3 max-w-3xl font-serif text-5xl font-medium leading-tight text-ivory">
            Your service, translated.
          </h1>
          <p className="mt-4 max-w-2xl text-cream/80">
            Enter your MOS, rating, or AFSC. We’ll show the civilian roles it prepares you for — your military background
            stays front and center, framed as the advantage it is.
          </p>
          <form action="/resources" method="get" className="mt-8 flex max-w-xl gap-2 rounded-[6px] bg-ivory p-2 shadow-lift">
            <label htmlFor="code" className="sr-only">Military occupation code or title</label>
            <input id="code" name="code" defaultValue={searchParams.code} placeholder="e.g. 11B, 0311, LS, 3P0X1, Infantryman" className="flex-1 rounded-[3px] px-4 py-3 text-ink outline-none" />
            <button type="submit" className="btn btn-primary">Translate</button>
          </form>
        </div>
      </section>

      <div className="container-page py-12">
        {code && results.length === 0 && (
          <div className="rounded-[4px] border border-dashed border-brass/50 p-8 text-center">
            <p className="font-serif text-xl">We don’t have “{searchParams.code}” on file yet.</p>
            <p className="mt-2 text-sm text-muted">Our translation library is growing. Try your job title, or browse the codes below.</p>
          </div>
        )}

        {results.map((occ) => (
          <article key={occ.id} className="card mb-6 p-7">
            <p className="eyebrow">{occ.branch} · {occ.code}</p>
            <h2 className="mt-2 font-serif text-3xl font-medium">{occ.title}</h2>
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-muted">Civilian careers</h3>
                <ul className="mt-3 space-y-2">
                  {occ.civilian_categories.map((c) => (
                    <li key={c}>
                      <Link href={`/jobs?q=${encodeURIComponent(c)}`} className="group flex items-center justify-between rounded-[3px] border border-line bg-paper px-4 py-2.5 text-ink hover:border-brass">
                        {c}
                        <span className="text-xs text-brass-dark opacity-0 transition-opacity group-hover:opacity-100">Search jobs →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-muted">How it reads on a résumé</h3>
                <p className="mt-3 font-serif text-xl leading-relaxed text-navy">{occ.civilian_skills.join(' · ')}</p>
              </div>
            </div>
          </article>
        ))}

        <section className="mt-6">
          <p className="eyebrow">Browse by branch</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {BRANCH_LIST.map((b) => (
              <Link key={b} href={`/resources?branch=${encodeURIComponent(b)}`}
                className={`rounded-full border px-4 py-1.5 text-sm ${branch === b ? 'border-navy bg-navy text-ivory' : 'border-line bg-ivory hover:border-brass'}`}>{b}</Link>
            ))}
          </div>
          {branch && (() => {
            const groups = new Map<string, { code: string; title: string }[]>();
            (directory ?? []).forEach((o) => {
              const field = (o.description ?? 'Other').replace('Occupational field: ', '');
              groups.set(field, [...(groups.get(field) ?? []), { code: o.code as string, title: o.title as string }]);
            });
            return (
              <div className="mt-6 space-y-6">
                <p className="text-sm text-muted">{(directory ?? []).length} {branch} occupations</p>
                {Array.from(groups.entries()).map(([field, items]) => (
                  <details key={field} className="card p-5">
                    <summary className="cursor-pointer font-serif text-xl">{field} <span className="font-sans text-sm text-muted">({items.length})</span></summary>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {items.map((o) => (
                        <Link key={o.code} href={`/resources?code=${encodeURIComponent(o.code)}`} className="rounded-[3px] border border-line bg-paper px-3 py-2 text-sm hover:border-brass">
                          <span className="font-semibold text-navy">{o.code}</span><span className="text-muted"> · {o.title}</span>
                        </Link>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            );
          })()}
          <p className="mt-8 text-xs text-muted">
            Occupation codes and titles for the Army, Marine Corps, Navy, Air Force, and Coast Guard. Civilian career paths and skills are LanceNest’s guidance based on each occupation’s field and duties — use them as a starting point, not an official equivalency.
          </p>
        </section>
      </div>
    </>
  );
}
