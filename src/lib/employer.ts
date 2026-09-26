import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type Plan = 'free' | 'professional' | 'federal' | 'enterprise';
export const PAID: Plan[] = ['professional', 'federal', 'enterprise'];
/** New candidates an employer may contact first each month (beyond people who applied). */
export const CONTACTS_PER_MONTH: Record<Plan, number> = { free: 0, professional: 50, federal: Infinity, enterprise: Infinity };
export const CLEARANCE_SEARCH: Plan[] = ['federal', 'enterprise'];
export const CLEARANCE_ORDER = ['none', 'public_trust', 'confidential', 'secret', 'top_secret', 'ts_sci'];
export const CLEARANCE_LABEL: Record<string, string> = { none: 'None', public_trust: 'Public Trust', confidential: 'Confidential', secret: 'Secret', top_secret: 'Top Secret', ts_sci: 'TS/SCI' };

export function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export async function getMyCompany(userId: string) {
  const { data } = await createClient().from('companies').select('*').eq('owner_id', userId).maybeSingle();
  return data as ({ id: string; name: string; slug: string; plan: Plan; contact_credits: number; extra_job_slots: number; stripe_customer_id: string | null } & Record<string, unknown>) | null;
}

export async function contactUsage(companyId: string, plan: Plan) {
  const { count } = await createClient().from('employer_contacts').select('*', { count: 'exact', head: true })
    .eq('company_id', companyId).eq('source', 'allowance').gte('created_at', monthStart());
  const limit = CONTACTS_PER_MONTH[plan];
  return { used: count ?? 0, limit, remaining: Number.isFinite(limit) ? Math.max(limit - (count ?? 0), 0) : Infinity };
}
