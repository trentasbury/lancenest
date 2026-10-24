import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type Plan = 'free' | 'starter' | 'professional' | 'federal' | 'enterprise';
/** Plans with talent search, analytics and exports. Starter is a paid plan without them. */
export const PAID: Plan[] = ['professional', 'federal', 'enterprise'];
/** Plans whose job feeds re-sync every day. */
export const FEED_SYNC: Plan[] = ['starter', 'professional', 'federal', 'enterprise'];
/** Open-job cap by plan (null = unlimited). Matches private.enforce_job_limit. */
export const JOB_CAP: Record<Plan, number | null> = { free: 2, starter: 5, professional: 10, federal: null, enterprise: null };
/** New candidates an employer may contact first each month (beyond people who applied). */
export const CONTACTS_PER_MONTH: Record<Plan, number> = { free: 0, starter: 0, professional: 50, federal: Infinity, enterprise: Infinity };
export const CLEARANCE_SEARCH: Plan[] = ['federal', 'enterprise'];
export const CLEARANCE_ORDER = ['none', 'public_trust', 'confidential', 'secret', 'top_secret', 'ts_sci'];
export const CLEARANCE_LABEL: Record<string, string> = { none: 'None', public_trust: 'Public Trust', confidential: 'Confidential', secret: 'Secret', top_secret: 'Top Secret', ts_sci: 'TS/SCI' };

export function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

/**
 * The company this employer owns — or recruits for as a team member (isOwner tells which).
 * Both lookups run at once, and the result is shared by everything rendering in one request.
 */
export const getMyCompany = cache(async (userId: string) => {
  // Includes private fields (billing ID, credits, verification details), so it reads with the server key,
  // strictly scoped to the company this signed-in user owns or belongs to. Never pass anyone else's id.
  const admin = createAdminClient();
  const [{ data: own }, { data: m }] = await Promise.all([
    admin.from('companies').select('*').eq('owner_id', userId).maybeSingle(),
    admin.from('company_members').select('company:companies(*)').eq('profile_id', userId).maybeSingle(),
  ]);
  if (own) return { ...own, isOwner: true } as MyCompany;
  const company = (m as unknown as { company: Record<string, unknown> | null } | null)?.company;
  return company ? ({ ...company, isOwner: false } as MyCompany) : null;
});

type MyCompany = { id: string; name: string; slug: string; plan: Plan; is_verified: boolean; verification_status: string; contact_credits: number; extra_job_slots: number; stripe_customer_id: string | null; isOwner: boolean } & Record<string, unknown>;
export const SEATS: Record<string, number> = { free: 1, starter: 1, professional: 2, federal: 5, enterprise: 20 };

export async function contactUsage(companyId: string, plan: Plan) {
  const { count } = await (await createClient()).from('employer_contacts').select('*', { count: 'exact', head: true })
    .eq('company_id', companyId).eq('source', 'allowance').gte('created_at', monthStart());
  const limit = CONTACTS_PER_MONTH[plan];
  return { used: count ?? 0, limit, remaining: Number.isFinite(limit) ? Math.max(limit - (count ?? 0), 0) : Infinity };
}
