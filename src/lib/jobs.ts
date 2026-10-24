import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { sanitizeSearch } from '@/lib/format';
import type { JobWithCompany } from '@/lib/types';

export type JobFilters = {
  q?: string;
  location?: string;
  state?: string;
  /** One or more of remote / hybrid / onsite (comma-separated or repeated). With a state: remote from anywhere + the others in that state. */
  arrangement?: string | string[];
  type?: string;
  clearance?: string;
  poly?: string;
  veteran?: string;
};

import { parseArrangements, placeFilter } from './place';

const JOB_SELECT = '*, company:companies(name, slug, logo_url, is_verified, industry)';

export async function searchJobs(filters: JobFilters, limit = 50): Promise<JobWithCompany[]> {
  const supabase = await createClient();
  let query = supabase.from('jobs').select(JOB_SELECT).eq('status', 'open');

  const q = sanitizeSearch(filters.q ?? '');
  let textExpr: string | null = null;
  if (q) {
    // Company-name matches are resolved first, then OR'd into the text search.
    const { data: companies } = await supabase.from('companies').select('id').ilike('name', `%${q}%`).limit(50);
    const ids = (companies ?? []).map((c) => c.id as string);
    // Ranked full-text search (stemmed: "managing" finds "manager") plus partial title matches while typing.
    const parts = [`search.wfts(english).${JSON.stringify(q)}`, `title.ilike.%${q}%`];
    if (ids.length) parts.push(`company_id.in.(${ids.join(',')})`);
    textExpr = `or(${parts.join(',')})`;
  }

  const location = sanitizeSearch(filters.location ?? '');
  if (location) query = query.ilike('location', `%${location}%`);
  // Where: a state means remote jobs from anywhere plus hybrid/on-site jobs in that state (see lib/place).
  // "multi" = jobs hiring in several locations.
  const arrangements = parseArrangements(filters.arrangement);
  let placeExpr: string | null = null;
  if (filters.state === 'multi') {
    query = query.eq('multi_location', true);
    placeExpr = placeFilter(null, arrangements);
  } else {
    placeExpr = placeFilter(filters.state, arrangements);
  }
  // Both conditions must hold, so they go into one filter joined with and().
  const both = [textExpr, placeExpr].filter(Boolean) as string[];
  if (both.length === 1) query = query.or(both[0]);
  if (both.length === 2) query = query.or(`and(${both.join(',')})`);
  if (filters.type && ['full_time', 'part_time', 'contract', 'internship', 'skillbridge'].includes(filters.type)) {
    query = query.eq('employment_type', filters.type);
  }
  if (filters.clearance === 'required') query = query.neq('clearance_required', 'none');
  if (filters.clearance === 'none') query = query.eq('clearance_required', 'none');
  if (filters.poly === 'any') query = query.neq('polygraph_required', 'none');
  if (filters.poly === 'none') query = query.eq('polygraph_required', 'none');
  if (filters.veteran === '1') query = query.eq('veteran_preferred', true);

  const { data, error } = await query.order('posted_at', { ascending: false }).limit(limit);
  if (error) {
    console.error('searchJobs failed:', error.message);
    return [];
  }
  return (data ?? []) as JobWithCompany[];
}

/** One lookup per request: the page title and the page share it. */
export const getJobBySlug = cache(async (slug: string): Promise<JobWithCompany | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from('jobs').select(JOB_SELECT).eq('slug', slug).maybeSingle();
  return (data as JobWithCompany | null) ?? null;
});

/** Active paid boosts, shown above regular results. */
export async function getFeaturedJobs(limit = 3): Promise<JobWithCompany[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('jobs').select(JOB_SELECT).eq('status', 'open').gt('featured_until', new Date().toISOString()).order('featured_until', { ascending: false }).limit(limit);
  return (data ?? []) as JobWithCompany[];
}
