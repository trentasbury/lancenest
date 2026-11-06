import type { Metadata } from 'next';
import Link from 'next/link';
import { BASES, BASE_BRANCHES, baseGroup } from '@/lib/bases';
import { CANONICAL_ORIGIN } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Jobs near military bases',
  description: 'Jobs, SkillBridge openings and career fairs near U.S. Army, Marine Corps, Navy, Air Force, Space Force and Coast Guard installations, from employers verified by LanceNest.',
  alternates: { canonical: `${CANONICAL_ORIGIN}/bases` },
};

const anchor = (g: string) => g.toLowerCase().replace(/[^a-z]+/g, '-');

export default function BasesPage() {
  const groups = BASE_BRANCHES.map((g) => [g, BASES.filter((b) => baseGroup(b) === g).sort((a, z) => a.name.localeCompare(z.name))] as const).filter(([, list]) => list.length);
  return (
    <div className="container-page max-w-5xl py-12">
      <p className="eyebrow">Jobs near base</p>
      <h1 className="mt-2 font-serif text-4xl font-medium leading-tight sm:text-5xl">Jobs near military bases</h1>
      <p className="mt-3 max-w-2xl text-muted">For service members getting ready to separate, and for spouses after a PCS: open jobs, SkillBridge openings and career fairs near {BASES.length} installations across every branch.</p>
      <nav className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Branches">
        {groups.map(([g, list]) => (
          <a key={g} href={`#${anchor(g)}`} className="whitespace-nowrap rounded-full border border-line bg-ivory px-4 py-1.5 text-sm text-ink hover:border-brass">{g} <span className="text-muted">{list.length}</span></a>
        ))}
      </nav>
      {groups.map(([g, list]) => (
        <section key={g} id={anchor(g)} className="mt-10 scroll-mt-24">
          <h2 className="font-serif text-2xl font-medium">{g}</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((b) => (
              <li key={b.slug}><Link href={`/bases/${b.slug}`} className="card card-hover block h-full p-4"><p className="font-semibold text-navy">{b.name}</p><p className="text-xs text-muted">{g === 'Joint' || g === 'Guard & Reserve' ? `${b.branch} · ` : ''}{b.city}</p></Link></li>
            ))}
          </ul>
        </section>
      ))}
      <p className="mt-10 text-xs text-muted">Installation names are used only to describe where jobs are. LanceNest is an independent company and isn’t affiliated with or endorsed by the Department of Defense, the Department of Homeland Security, or any branch of the U.S. Armed Forces or installation. Don’t see yours? <Link href="/help?kind=idea&subject=Add%20a%20base" className="underline">Tell us</Link>.</p>
    </div>
  );
}
