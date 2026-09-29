import type { Metadata } from 'next';
import Link from 'next/link';
import { GUIDES } from '@/lib/guides';

export const metadata: Metadata = { title: 'Transition guides for service members and veterans', description: 'Plain-English guides to SkillBridge, the GI Bill, cleared jobs, résumés, freelancing, and Guard & Reserve careers.' };

export default function GuidesPage() {
  return (
    <>
      <section className="bg-navy-deep text-ivory"><div className="container-page py-14">
        <p className="eyebrow text-brass">Transition guides</p>
        <h1 className="mt-2 font-serif text-4xl font-medium text-ivory sm:text-5xl">Straight answers for your next move.</h1>
        <p className="mt-3 max-w-2xl text-cream/80">Practical guides for service members, Guard and Reserve, and veterans — with links to the official sources.</p>
      </div></section>
      <div className="container-page grid gap-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
        {GUIDES.map((g) => (
          <Link key={g.slug} href={`/guides/${g.slug}`} className="card flex flex-col p-6 hover:border-brass">
            <p className="font-serif text-2xl text-navy">{g.title}</p>
            <p className="mt-2 text-sm text-muted">{g.description}</p>
            <span className="mt-auto pt-4 text-sm text-navy">Read the guide →</span>
          </Link>
        ))}
      </div>
    </>
  );
}
