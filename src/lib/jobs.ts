import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { sanitizeSearch } from '@/lib/format';
import type { JobWithCompany } from '@/lib/types';

export type JobFilters = {
  q?: string;
  location?: string;
  arrangement?: string;
  type?: string;
  clearance?: string;
  veteran?: string;
};

const JOB_SELECT = '*, company:companies(name, slug, logo_url, is_verified, industry)';

export async function searchJobs(filters: JobFilters, limit = 50): Promise<JobWithCompany[]> {
  const supabase = createClient();
  let query = supabase.from('jobs').select(JOB_SELECT).eq('status', 'open');

  const q = sanitizeSearch(filters.q ?? '');
  if (q) {
    // Company-name matches are resolved first, then OR'd into the text search.
    const { data: companies } = await supabase.from('companies').select('id').ilike('name', `%${q}%`).limit(50);
    const ids = (companies ?? []).map((c) => c.id as string);
    const parts = [`title.ilike.%${q}%`, `description.ilike.%${q}%`, `industry.ilike.%${q}%`];
    if (ids.length) parts.push(`company_id.in.(${ids.join(',')})`);
    query = query.or(parts.join(','));
  }

  const location = sanitizeSearch(filters.location ?? '');
  if (location) query = query.ilike('location', `%${location}%`);
  if (filters.arrangement && ['remote', 'hybrid', 'onsite'].includes(filters.arrangement)) {
    query = query.eq('work_arrangement', filters.arrangement);
  }
  if (filters.type && ['full_time', 'part_time', 'contract', 'internship', 'skillbridge'].includes(filters.type)) {
    query = query.eq('employment_type', filters.type);
  }
  if (filters.clearance === 'required') query = query.neq('clearance_required', 'none');
  if (filters.clearance === 'none') query = query.eq('clearance_required', 'none');
  if (filters.veteran === '1') query = query.eq('veteran_preferred', true);

  const { data, error } = await query.order('posted_at', { ascending: false }).limit(limit);
  if (error) {
    console.error('searchJobs failed:', error.message);
    return [];
  }
  return (data ?? []) as JobWithCompany[];
}

export async function getJobBySlug(slug: string): Promise<JobWithCompany | null> {
  const supabase = createClient();
  const { data } = await supabase.from('jobs').select(JOB_SELECT).eq('slug', slug).maybeSingle();
  return (data as JobWithCompany | null) ?? null;
}

/** Active paid boosts, shown above regular results. */
export async function getFeaturedJobs(limit = 3): Promise<JobWithCompany[]> {
  const supabase = createClient();
  const { data } = await supabase.from('jobs').select(JOB_SELECT).eq('status', 'open').gt('featured_until', new Date().toISOString()).order('featured_until', { ascending: false }).limit(limit);
  return (data ?? []) as JobWithCompany[];
}
