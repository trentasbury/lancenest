import type { MetadataRoute } from 'next';
import { BRANCH_SLUGS, publicDb, slugFromBranch } from '@/lib/careers';
import { GUIDES } from '@/lib/guides';
import { publicJobSitemap } from '@/lib/publicJobs';

export const revalidate = 3600;
import { CANONICAL_ORIGIN } from '@/lib/seo';
const SITE = CANONICAL_ORIGIN;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The database returns at most 1,000 rows per request: page through all 1,469 occupations.
  const data: { code: string; branch: string }[] = [];
  for (let from = 0; from < 10000; from += 1000) {
    const { data: rows } = await publicDb().from('military_occupations').select('code, branch').order('id').range(from, from + 999);
    data.push(...((rows ?? []) as { code: string; branch: string }[]));
    if (!rows || rows.length < 1000) break;
  }
  const fixed = ['', '/about', '/employers', '/plans', '/careers', '/guides', '/trust', '/payments-protection', '/resources', '/open-jobs', '/pay', '/signup', '/terms', '/privacy', '/help', '/copyright', '/licenses'].map((p) => ({ url: `${SITE}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.7 }));
  const careers = data.map((o) => ({ url: `${SITE}/careers/${slugFromBranch(o.branch)}/${o.code.toLowerCase()}`, changeFrequency: 'monthly' as const, priority: 0.6 }));
  const branches = BRANCH_SLUGS.filter(([s]) => s !== 'army').map(([s]) => ({ url: `${SITE}/careers/${s}`, changeFrequency: 'monthly' as const, priority: 0.6 }));
  const guides = GUIDES.map((g) => ({ url: `${SITE}/guides/${g.slug}`, changeFrequency: 'monthly' as const, priority: 0.7 }));
  const jobs = (await publicJobSitemap()).map((j) => ({ url: `${SITE}/open-jobs/${j.slug}`, lastModified: j.updated_at, changeFrequency: 'daily' as const, priority: 0.8 }));
  return [...fixed, ...jobs, ...branches, ...guides, ...careers];
}
