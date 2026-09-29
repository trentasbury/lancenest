import type { Metadata } from 'next';
import Link from 'next/link';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CATEGORIES, DELIVERY_LABEL, PRICE_LABEL } from '@/lib/freelance';
import { sanitizeSearch } from '@/lib/format';
import Avatar from '@/components/network/Avatar';
import VerifiedMark from '@/components/VerifiedMark';

export const metadata: Metadata = { title: 'Services by verified service members' };
type S = { id: string; title: string; category: string; description: string; price_cents: number; price_type: string; delivery: string; service_area: string | null;
  provider: { full_name: string; username: string | null; avatar_url: string | null; verified: boolean } | null };

export default async function ServicesPage({ searchParams }: { searchParams: { category?: string; q?: string; where?: string } }) {
  await requireVerifiedMember('/freelance/services');
  const supabase = createClient();
  let query = supabase.from('service_listings').select('id, title, category, description, price_cents, price_type, delivery, service_area, provider:profiles!service_listings_profile_id_fkey(full_name, username, avatar_url, verified)').eq('status', 'active');
  if (searchParams.category && CATEGORIES.includes(searchParams.category)) query = query.eq('category', searchParams.category);
  const q = sanitizeSearch(searchParams.q ?? ''), where = sanitizeSearch(searchParams.where ?? '');
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  if (where) query = query.or(`service_area.ilike.%${where}%,delivery.neq.on_site`);
  const { data } = await query.order('created_at', { ascending: false }).limit(60);
  const services = (data ?? []) as unknown as S[];
  return (
    <div className="container-page max-w-6xl space-y-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-serif text-4xl font-medium">Services</h1><p className="mt-1 text-muted">Hire verified service members for anything — auto repair, HVAC, web design, and more. Payment is protected until the work is done.</p></div>
        <Link href="/freelance/services/mine" className="btn btn-outline">Offer a service</Link>
      </div>
      <form method="get" className="card grid gap-3 p-4 sm:grid-cols-4">
        <input name="q" defaultValue={searchParams.q} placeholder="What do you need done?" className="field sm:col-span-2" />
        <input name="where" defaultValue={searchParams.where} placeholder="City or state (on-site work)" className="field" />
        <select name="category" defaultValue={searchParams.category ?? ''} className="field"><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <button className="btn btn-primary sm:col-span-4 sm:justify-self-start">Search</button>
      </form>
      {services.length === 0 ? <p className="card p-8 text-center text-muted">No services match yet. Try a broader search — or post a job and let members come to you.</p> : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <li key={s.id}><Link href={`/freelance/services/${s.id}`} className="card flex h-full flex-col gap-2 p-5 hover:border-brass">
              <p className="text-xs uppercase tracking-[0.12em] text-brass-dark">{s.category}</p>
              <p className="font-serif text-xl text-navy">{s.title}</p>
              <p className="line-clamp-2 text-sm text-ink/80">{s.description}</p>
              <div className="mt-auto flex items-center justify-between pt-2 text-sm">
                <span className="flex items-center gap-2"><Avatar name={s.provider?.full_name} src={s.provider?.avatar_url} size="sm" />{s.provider?.full_name}{s.provider?.verified && <VerifiedMark />}</span>
                <span className="font-semibold">${(s.price_cents / 100).toLocaleString()}{PRICE_LABEL[s.price_type]}</span>
              </div>
              <p className="text-xs text-muted">{DELIVERY_LABEL[s.delivery]}{s.service_area ? ` · ${s.service_area}` : ''}</p>
            </Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}
