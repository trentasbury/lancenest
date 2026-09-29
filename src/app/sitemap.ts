import type { MetadataRoute } from 'next';
import { publicDb, slugFromBranch } from '@/lib/careers';
import { GUIDES } from '@/lib/guides';

export const revalidate = 86400;
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lancenest.com').replace(/\/$/, '');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data } = await publicDb().from('military_occupations').select('code, branch').limit(5000);
  const fixed = ['', '/about', '/employers', '/plans', '/careers', '/guides', '/resources', '/signup', '/terms', '/privacy'].map((p) => ({ url: `${SITE}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.7 }));
  const careers = (data ?? []).map((o) => ({ url: `${SITE}/careers/${slugFromBranch(o.branch as string)}/${(o.code as string).toLowerCase()}`, changeFrequency: 'monthly' as const, priority: 0.6 }));
  const guides = GUIDES.map((g) => ({ url: `${SITE}/guides/${g.slug}`, changeFrequency: 'monthly' as const, priority: 0.7 }));
  return [...fixed, ...guides, ...careers];
}
