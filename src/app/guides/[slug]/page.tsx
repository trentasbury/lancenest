import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GUIDES } from '@/lib/guides';

export function generateStaticParams() { return GUIDES.map((g) => ({ slug: g.slug })); }
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const g = GUIDES.find((x) => x.slug === params.slug);
  return g ? { title: g.title, description: g.description, alternates: { canonical: `/guides/${g.slug}` } } : { title: 'Guide' };
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const g = GUIDES.find((x) => x.slug === params.slug);
  if (!g) notFound();
  return (
    <>
      <section className="bg-navy-deep text-ivory"><div className="container-page max-w-3xl py-14">
        <Link href="/guides" className="text-sm text-cream/70 hover:text-brass">← All guides</Link>
        <h1 className="mt-3 font-serif text-4xl font-medium text-ivory sm:text-5xl">{g.title}</h1>
        <p className="mt-3 text-cream/80">{g.description}</p>
      </div></section>
      <article className="container-page max-w-3xl space-y-8 py-12 text-[17px] leading-relaxed text-ink/90">
        {g.sections.map((s) => (
          <section key={s.h}>
            <h2 className="font-serif text-2xl text-navy">{s.h}</h2>
            {s.p?.map((t, i) => <p key={i} className="mt-3">{t}</p>)}
            {s.list && <ul className="mt-3 list-disc space-y-2 pl-6">{s.list.map((t, i) => <li key={i}>{t}</li>)}</ul>}
          </section>
        ))}
        <section className="card p-6">
          <p className="eyebrow">Official sources and next steps</p>
          <ul className="mt-3 space-y-2">{g.links.map(([label, href]) => <li key={href}>{href.startsWith('http') ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-navy underline">{label} ↗</a> : <Link href={href} className="text-navy underline">{label}</Link>}</li>)}</ul>
        </section>
        <p className="text-xs text-muted">General information, not legal, financial, or official military guidance. Rules change — always confirm with the official source or your transition office. LanceNest is not affiliated with the Department of Defense, the VA, or any military branch.</p>
        <div className="rounded-[6px] bg-navy p-6 text-ivory"><p className="font-serif text-2xl">Join the verified network for service members.</p><Link href="/signup?role=veteran" className="btn btn-brass mt-4">Create your free profile</Link></div>
      </article>
    </>
  );
}
