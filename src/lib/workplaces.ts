import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * "Veterans who work here" and employer ratings. Both tables are read only here, with the server key:
 * - everyone sees counts and average scores;
 * - verified members see names (of people who chose to be listed) and the written reviews;
 * - employers never see who wrote a rating.
 */
export type Person = { id: string; username: string | null; full_name: string; avatar_url: string | null; headline: string | null; title: string | null; is_current: boolean; open_to_referrals: boolean };
export type RatingSummary = { count: number; overall: number; veteranSupport: number; recommendPct: number };
export type Review = { id: string; overall: number; veteran_support: number; recommend: boolean; pros: string | null; cons: string | null; was_current: boolean; employer_response: string | null; created_at: string };

/** Averages are shown only once there are at least this many ratings, so no single rater can be picked out. */
export const MIN_RATINGS = 3;

export async function companyPeople(companyId: string, viewerCanSeeNames: boolean): Promise<{ count: number; people: Person[] }> {
  const admin = createAdminClient();
  const { data, count } = await admin.from('company_people')
    .select('title, is_current, open_to_referrals, profile:profiles!inner(id, username, full_name, avatar_url, headline, banned, verified)', { count: 'exact' })
    .eq('company_id', companyId).eq('profile.banned', false).eq('profile.verified', true)
    .order('is_current', { ascending: false }).limit(viewerCanSeeNames ? 24 : 1);
  const people = viewerCanSeeNames
    ? ((data ?? []) as unknown as { title: string | null; is_current: boolean; open_to_referrals: boolean; profile: { id: string; username: string | null; full_name: string; avatar_url: string | null; headline: string | null } }[])
        .map((r) => ({ ...r.profile, title: r.title, is_current: r.is_current, open_to_referrals: r.open_to_referrals }))
    : [];
  return { count: count ?? 0, people };
}

export async function myWorkplace(profileId: string, companyId: string) {
  const { data } = await createAdminClient().from('company_people').select('is_current, title, open_to_referrals').eq('profile_id', profileId).eq('company_id', companyId).maybeSingle();
  return data as { is_current: boolean; title: string | null; open_to_referrals: boolean } | null;
}

export async function ratingSummary(companyId: string): Promise<RatingSummary | null> {
  const { data } = await createAdminClient().from('company_ratings').select('overall, veteran_support, recommend').eq('company_id', companyId).eq('status', 'visible').limit(5000);
  const rows = (data ?? []) as { overall: number; veteran_support: number; recommend: boolean }[];
  if (rows.length < MIN_RATINGS) return rows.length ? { count: rows.length, overall: 0, veteranSupport: 0, recommendPct: 0 } : null;
  const avg = (f: (r: (typeof rows)[number]) => number) => Math.round((rows.reduce((s, r) => s + f(r), 0) / rows.length) * 10) / 10;
  return { count: rows.length, overall: avg((r) => r.overall), veteranSupport: avg((r) => r.veteran_support), recommendPct: Math.round((rows.filter((r) => r.recommend).length / rows.length) * 100) };
}

/** Written reviews, without the reviewer. For verified members and the company's own team, once there are enough ratings. */
export async function companyReviews(companyId: string, limit = 10): Promise<Review[]> {
  const { data } = await createAdminClient().from('company_ratings').select('id, overall, veteran_support, recommend, pros, cons, was_current, employer_response, created_at')
    .eq('company_id', companyId).eq('status', 'visible').order('created_at', { ascending: false }).limit(limit);
  return (data ?? []) as Review[];
}

export async function myRating(profileId: string, companyId: string) {
  const { data } = await createAdminClient().from('company_ratings').select('overall, veteran_support, recommend, pros, cons').eq('profile_id', profileId).eq('company_id', companyId).maybeSingle();
  return data as { overall: number; veteran_support: number; recommend: boolean; pros: string | null; cons: string | null } | null;
}
