import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { sanitizeSearch } from '@/lib/format';
import type { MilitaryOccupation } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Translate Your Military Occupation',
  description: 'See the civilian careers and skills your MOS, rating, or AFSC prepares you for.',
};

export default async function ResourcesPage({ searchParams }: { searchParams: { code?: string } }) {
  const supabase = createClient();
  const code = sanitizeSearch(searchParams.code ?? '');

  const [{ data: matches }, { data: directory }] = await Promise.all([
    code
      ? supabase.from('military_occupations').select('*').or(`code.ilike.${code},title.ilike.%${code}%`).limit(10)
      : Promise.resolve({ data: [] as MilitaryOccupation[] }),
    supabase.from('military_occupations').select('code, branch, title').order('branch').order('code'),
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
          <p className="eyebrow">Occupations on file</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(directory ?? []).map((o) => (
              <Link
                key={`${o.branch}-${o.code}`}
                href={`/resources?code=${encodeURIComponent(o.code as string)}`}
                className="rounded-[3px] border border-line bg-ivory px-4 py-3 text-sm hover:border-brass"
              >
                <span className="font-semibold text-navy">{o.code as string}</span>
                <span className="text-muted"> · {o.title as string} · {o.branch as string}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
