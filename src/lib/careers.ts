import { createClient as createPublicClient } from '@supabase/supabase-js';

export const BRANCH_SLUGS: [string, string][] = [['army', 'Army'], ['marine-corps', 'Marine Corps'], ['navy', 'Navy'], ['air-force', 'Air Force'], ['space-force', 'Space Force'], ['coast-guard', 'Coast Guard']];
export const branchFromSlug = (slug: string) => BRANCH_SLUGS.find(([s]) => s === slug)?.[1] ?? null;
export const slugFromBranch = (branch: string) => BRANCH_SLUGS.find(([, b]) => b === branch)?.[0] ?? branch.toLowerCase().replace(/\s+/g, '-');

/** Cookie-free client for public, cacheable pages (occupations are public data). */
export function publicDb() {
  return createPublicClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
}
