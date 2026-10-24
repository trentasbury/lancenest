import 'server-only';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { CATEGORIES } from '@/lib/freelance';
import { stateOf } from '@/lib/place';

/**
 * Public service pages (/hire). Only services their owner opted in to, from verified members in good standing.
 * Shown: first name and last initial, city and state, the service and its packages. Never shown: photo, full name,
 * profile link or contact details (listings already can't contain contact details; the database blocks them).
 * Booking still happens signed in, so the booking fee and contact rules apply.
 */

export type PublicService = {
  id: string; title: string; category: string; description: string; price_cents: number; price_type: string; delivery: string;
  service_area: string | null; packages: { name: string; price_cents: number; days: number; includes: string }[];
  provider: string; memberType: 'service_member' | 'spouse'; city: string | null; state: string | null; updated_at: string;
};

export const categorySlug = (c: string) => c.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const categoryFromSlug = (slug: string) => CATEGORIES.find((c) => categorySlug(c) === slug) ?? null;

const shortName = (full: string | null) => {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'A verified member';
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
};

export const allPublicServices = unstable_cache(async (): Promise<PublicService[]> => {
  const admin = createAdminClient();
  const { data, error } = await admin.from('service_listings')
    .select('id, title, category, description, price_cents, price_type, delivery, service_area, packages, updated_at, profile_id, provider:profiles!service_listings_profile_id_fkey(full_name, banned, suspended_until)')
    .eq('status', 'active').eq('public_listing', true).order('updated_at', { ascending: false }).limit(2000);
  if (error) { console.error('allPublicServices failed:', error.message); return []; }
  const rows = (data ?? []) as unknown as (Omit<PublicService, 'provider' | 'memberType' | 'city' | 'state'> & { profile_id: string; provider: { full_name: string | null; banned: boolean; suspended_until: string | null } | null })[];
  const ids = [...new Set(rows.map((r) => r.profile_id))];
  const { data: vets } = ids.length ? await admin.from('veteran_profiles').select('profile_id, verification_status, member_type, city, state').in('profile_id', ids) : { data: [] };
  const vetOf = new Map((vets ?? []).map((v) => [v.profile_id as string, v]));
  const now = Date.now();
  return rows.flatMap((r) => {
    const v = vetOf.get(r.profile_id);
    if (!v || v.verification_status !== 'verified' || !r.provider || r.provider.banned) return [];
    if (r.provider.suspended_until && Date.parse(r.provider.suspended_until) > now) return [];
    const st = stateOf((v.state as string | null) ?? '');
    return [{
      id: r.id, title: r.title, category: r.category, description: r.description, price_cents: r.price_cents, price_type: r.price_type, delivery: r.delivery,
      service_area: r.service_area, packages: Array.isArray(r.packages) ? r.packages : [], updated_at: r.updated_at,
      provider: shortName(r.provider.full_name), memberType: (v.member_type as 'service_member' | 'spouse') ?? 'service_member',
      city: (v.city as string | null) ?? null, state: st ? st[0] : null,
    }];
  });
}, ['public-services-v1'], { revalidate: 600, tags: ['public-services'] });

export async function getPublicService(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  return (await allPublicServices()).find((s) => s.id === id) ?? null;
}
