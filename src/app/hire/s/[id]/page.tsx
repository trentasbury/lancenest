import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DELIVERY_LABEL, PRICE_LABEL } from '@/lib/freelance';
import { categorySlug, getPublicService } from '@/lib/publicServices';
import { CANONICAL_ORIGIN } from '@/lib/seo';
import { usd } from '@/lib/booking';
import { providerLine } from '../../ServiceCard';

export const revalidate = 600;

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const s = await getPublicService((await props.params).id);
  if (!s) return { robots: { index: false } };
  return { title: `${s.title} · ${s.category}`, description: s.description.slice(0, 155), alternates: { canonical: `${CANONICAL_ORIGIN}/hire/s/${s.id}` } };
}

export default async function PublicServicePage(props: { params: Promise<{ id: string }> }) {
  const s = await getPublicService((await props.params).id);
  if (!s) notFound();
  const book = `/login?next=${encodeURIComponent(`/freelance/services/${s.id}`)}`;
  return (
    <div className="container-page grid max-w-5xl gap-8 py-12 lg:grid-cols-[1fr_320px]">
      <article className="min-w-0 space-y-5">
        <Link href={`/hire/${categorySlug(s.category)}`} className="text-sm text-muted hover:text-navy">← {s.category}</Link>
        <h1 className="font-serif text-4xl font-medium leading-tight">{s.title}</h1>
        <p className="text-sm text-muted">{providerLine(s)} · {DELIVERY_LABEL[s.delivery] ?? 'Remote'}{s.service_area ? ` · ${s.service_area}` : ''}</p>
        <p className="inline-flex items-center gap-1.5 rounded-full border border-olive/40 bg-olive/10 px-3 py-1 text-xs font-semibold text-olive">✓ Military service verified by LanceNest</p>
        <div className="card whitespace-pre-line p-6 text-ink/90">{s.description}</div>
        {s.packages.length > 0 && (
          <div className={`grid gap-3 ${s.packages.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            {s.packages.map((p) => (
              <div key={p.name} className="card p-5">
                <p className="font-semibold text-navy">{p.name}</p>
                <p className="mt-1 font-serif text-2xl text-navy">{usd(p.price_cents)}</p>
                <p className="text-xs text-muted">Delivered in {p.days} day{p.days === 1 ? '' : 's'}</p>
                <p className="mt-2 text-sm text-ink/85">{p.includes}</p>
              </div>
            ))}
          </div>
        )}
      </article>
      <aside>
        <div className="card sticky top-24 space-y-3 p-6">
          <p className="font-serif text-3xl text-navy">${(s.price_cents / 100).toLocaleString()}<span className="text-base text-muted">{PRICE_LABEL[s.price_type]}</span></p>
          <Link href={book} className="btn btn-primary w-full">Book on LanceNest</Link>
          <Link href="/signup?role=client" className="btn btn-outline w-full">Create a free client account</Link>
          <p className="text-xs text-muted">You pay a small booking fee when you hire (from $4.99, never more than $99.99), refunded if the pro declines within 48 hours. Contact details open up once you’re booked.</p>
        </div>
      </aside>
    </div>
  );
}
