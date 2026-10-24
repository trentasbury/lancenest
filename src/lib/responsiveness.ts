import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * How fast each employer answers applicants: the median days from applying to the employer's first status change
 * (viewed, interview, offer or not selected), with unanswered applications counted as no answer. Computed in the
 * database (public.company_response_days, service role only) and shown only once an employer has 5+ applications.
 */
const NO_ANSWER = 9999;

export const responseDays = cache(async (companyIds: string[]): Promise<Map<string, number>> => {
  const ids = [...new Set(companyIds.filter(Boolean))].slice(0, 500);
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const { data, error } = await createAdminClient().rpc('company_response_days', { ids });
  if (error) { console.error('company_response_days failed:', error.message); return out; }
  for (const r of (data ?? []) as { company_id: string; median_days: number }[]) out.set(r.company_id, Number(r.median_days));
  return out;
});

/** The public badge. Only good news is shown; slow or unanswered employers simply get no badge. */
export function responseLabel(days: number | undefined | null): string | null {
  if (days == null || !Number.isFinite(days) || days >= 15) return null;
  if (days < 1) return 'Usually responds within a day';
  const d = Math.ceil(days);
  return `Usually responds in ${d} day${d === 1 ? '' : 's'}`;
}

/** The employer's own view, including when most applicants are still waiting. */
export function ownResponseNote(days: number | undefined | null): string {
  if (days == null) return 'Your response time appears once 5 applicants have applied in the last 6 months.';
  if (days >= NO_ANSWER) return 'Most of your applicants haven’t heard back yet. Answer them to earn a “usually responds” badge on your jobs.';
  if (days >= 15) return `You usually answer applicants in about ${Math.ceil(days)} days. Answer within 14 to show a “usually responds” badge on your jobs.`;
  return `You usually answer applicants in ${days < 1 ? 'under a day' : `${Math.ceil(days)} day${Math.ceil(days) === 1 ? '' : 's'}`}, so your jobs show a “usually responds” badge.`;
}
