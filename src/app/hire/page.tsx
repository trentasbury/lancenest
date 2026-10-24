import type { Metadata } from 'next';
import Link from 'next/link';
import { CATEGORIES } from '@/lib/freelance';
import { allPublicServices, categorySlug } from '@/lib/publicServices';
import { CANONICAL_ORIGIN } from '@/lib/seo';
import ServiceCard from './ServiceCard';

export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Hire a veteran freelancer',
  description: 'Book verified veterans and military spouses for IT, cyber, design, logistics, trades and more. Every provider’s service is verified, and pros never pay lead fees.',
  alternates: { canonical: `${CANONICAL_ORIGIN}/hire` },
};

export default async function HirePage() {
  const services = await allPublicServices();
  const count = new Map<string, number>();
  services.forEach((s) => count.set(s.category, (count.get(s.category) ?? 0) + 1));
  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page py-16">
          <p className="eyebrow text-brass">Hire a veteran freelancer</p>
          <h1 className="mt-3 max-w-3xl font-serif text-5xl font-medium leading-tight text-ivory">Verified veterans and military spouses, ready for your project.</h1>
          <p className="mt-4 max-w-2xl text-cream/80">From cybersecurity and web design to HVAC and moving help. Every provider’s military service is checked by a person, licensed trades need a verified license, and the pros you hire never pay lead fees.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup?role=employer" className="btn btn-brass">Create a free client account</Link>
            <Link href="/freelance/projects/new" className="btn border border-cream/30 text-ivory hover:bg-white/10">Post a project</Link>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-cream">
        <ol className="container-page grid gap-4 py-10 md:grid-cols-3">
          {[['1. Pick a service or post a project', 'Browse verified pros below, or describe the job and let them send proposals.'],
            ['2. Book on LanceNest', 'You pay a small booking fee when you hire (from $4.99, never more than $99.99). The pro pays nothing to be booked.'],
            ['3. Work together', 'Contact details open up once the job is booked. Licensed trades show a verified license.']].map(([h, b]) => (
            <li key={h} className="card p-5"><p className="font-semibold text-navy">{h}</p><p className="mt-1 text-sm text-muted">{b}</p></li>
          ))}
        </ol>
      </section>

      <div className="container-page space-y-12 py-12">
        <section>
          <h2 className="font-serif text-3xl font-medium text-navy">Browse by service</h2>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.filter((c) => c !== 'Other').map((c) => (
              <li key={c}><Link href={`/hire/${categorySlug(c)}`} className="flex items-center justify-between rounded-xl border border-line bg-ivory px-4 py-3 text-sm hover:border-brass">
                <span className="text-ink">{c}</span><span className="text-xs text-muted">{count.get(c) ? `${count.get(c)} pro${count.get(c) === 1 ? '' : 's'}` : 'Post a project'}</span></Link></li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="font-serif text-3xl font-medium text-navy">Newest services</h2>
          {services.length === 0 ? (
            <div className="card mt-5 p-8 text-center"><p className="font-semibold text-ink">Public services are on the way.</p><p className="mt-2 text-sm text-muted">Signed-in clients see every service now, and you can post a project for verified pros to answer.</p><Link href="/signup?role=employer" className="btn btn-primary mt-5">Create a free client account</Link></div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{services.slice(0, 24).map((s) => <ServiceCard key={s.id} s={s} />)}</div>
          )}
        </section>
      </div>
    </>
  );
}
