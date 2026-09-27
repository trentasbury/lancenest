import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { FREELANCE_FEES } from '@/lib/fees';

export const FREE_PROPOSALS_PER_MONTH = 10;
export const CATEGORIES = ['Cybersecurity', 'IT & ServiceNow', 'Software development', 'Program & project management', 'Logistics & supply chain',
  'Security consulting', 'Training & instruction', 'Intelligence & analysis', 'Writing & proposals', 'Design & media', 'Operations', 'Other'];

/** What the veteran keeps from a payment, by plan (percent). */
export function keepPercent(plan: string) {
  return Math.round((1 - (FREELANCE_FEES.veteranRate[plan] ?? FREELANCE_FEES.veteranRate.free)) * 100);
}

export async function proposalsUsedThisMonth(profileId: string) {
  const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { count } = await createClient().from('proposals').select('id', { count: 'exact', head: true }).eq('freelancer_id', profileId).gte('created_at', start);
  return count ?? 0;
}
