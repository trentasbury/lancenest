import type { Metadata } from 'next';
import Link from 'next/link';
import { BASES } from '@/lib/bases';
import { CANONICAL_ORIGIN } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Jobs near military bases',
  description: 'Jobs, SkillBridge openings and career fairs near major U.S. military installations, from employers verified by LanceNest.',
  alternates: { canonical: `${CANONICAL_ORIGIN}/bases` },
};

export default function BasesPage() {
  return (
    <div className="container-page max-w-5xl py-12">
      <p className="eyebrow">Jobs near base</p>
      <h1 className="mt-2 font-serif text-4xl font-medium leading-tight sm:text-5xl">Jobs near military bases</h1>
      <p className="mt-3 max-w-2xl text-muted">For service members getting ready to separate, and for spouses after a PCS: open jobs, SkillBridge openings and career fairs near each installation.</p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BASES.map((b) => (
          <li key={b.slug}><Link href={`/bases/${b.slug}`} className="card card-hover block p-4"><p className="font-semibold text-navy">{b.name}</p><p className="text-xs text-muted">{b.branch} · {b.city}</p></Link></li>
        ))}
      </ul>
    </div>
  );
}
