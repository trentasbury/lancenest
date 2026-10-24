import Link from 'next/link';
import { DELIVERY_LABEL, PRICE_LABEL } from '@/lib/freelance';
import type { PublicService } from '@/lib/publicServices';

export const providerLine = (s: PublicService) =>
  [s.provider, s.memberType === 'spouse' ? 'Verified military spouse' : 'Verified veteran', [s.city, s.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ');

const from = (s: PublicService) => Math.min(s.price_cents, ...s.packages.map((p) => p.price_cents));

export default function ServiceCard({ s }: { s: PublicService }) {
  return (
    <Link href={`/hire/s/${s.id}`} className="card card-hover group flex flex-col p-5">
      <p className="text-[11px] uppercase tracking-[0.12em] text-brass-dark">{s.category}</p>
      <p className="mt-1 font-semibold leading-snug text-navy group-hover:underline group-hover:decoration-brass/60 group-hover:underline-offset-4">{s.title}</p>
      <p className="mt-1 text-xs text-muted">{providerLine(s)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="pill">{DELIVERY_LABEL[s.delivery] ?? 'Remote'}</span>
        {s.packages.length > 0 && <span className="pill">{s.packages.length} package{s.packages.length === 1 ? '' : 's'}</span>}
        <span className="ml-auto font-semibold text-navy">{s.packages.length ? 'From ' : ''}${(from(s) / 100).toLocaleString()}{s.packages.length ? '' : PRICE_LABEL[s.price_type]}</span>
      </div>
    </Link>
  );
}
