import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export { GOOGLE_SIGNIN } from '@/lib/flags';

/** An account counts as brand new for 30 minutes after it's created (long enough to finish the Google round trip). */
const FRESH_MS = 30 * 60 * 1000;
export function isFreshAccount(createdAt?: string | null) {
  return !!createdAt && Date.now() - Date.parse(createdAt) < FRESH_MS;
}

/**
 * The database starts every new account as a service member (Google can't send the account type we ask for).
 * When someone chose "I'm hiring", switch their brand-new, untouched account to an employer account.
 * Never touches an account that is older than 30 minutes or has started verification or applied to jobs.
 */
export async function makeEmployerIfNew(userId: string, createdAt: string | null | undefined): Promise<boolean> {
  const admin = createAdminClient();
  const { data: p } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (p?.role === 'employer') return true;
  if (p?.role !== 'veteran' || !isFreshAccount(createdAt)) return false;
  const [{ count: requests }, { count: applications }] = await Promise.all([
    admin.from('verification_requests').select('id', { count: 'exact', head: true }).eq('profile_id', userId),
    admin.from('applications').select('id', { count: 'exact', head: true }).eq('profile_id', userId),
  ]);
  if ((requests ?? 0) > 0 || (applications ?? 0) > 0) return false;
  const { error } = await admin.from('profiles').update({ role: 'employer' }).eq('id', userId);
  if (error) return false;
  await admin.from('veteran_profiles').delete().eq('profile_id', userId);
  return true;
}

/** "I'm a military spouse" through Google: mark a brand-new, untouched member account as a spouse account. */
export async function makeSpouseIfNew(userId: string, createdAt: string | null | undefined): Promise<boolean> {
  if (!isFreshAccount(createdAt)) return false;
  const admin = createAdminClient();
  const { count } = await admin.from('verification_requests').select('id', { count: 'exact', head: true }).eq('profile_id', userId);
  if ((count ?? 0) > 0) return false;
  const { error } = await admin.from('veteran_profiles').update({ member_type: 'spouse' }).eq('profile_id', userId).eq('verification_status', 'not_verified');
  return !error;
}

/** Referral links: remember who invited a brand-new member (same rule as email sign-up). */
export async function applyReferral(userId: string, refRaw: string | null | undefined) {
  const ref = (refRaw ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);
  if (!ref) return;
  const admin = createAdminClient();
  const { data: me } = await admin.from('profiles').select('referred_by').eq('id', userId).maybeSingle();
  if (me?.referred_by) return;
  const { data: referrer } = ref.startsWith('c-')
    ? await admin.from('companies').select('id:owner_id').eq('slug', ref.slice(2)).maybeSingle()
    : await admin.from('profiles').select('id').eq('username', ref).in('role', ['veteran', 'admin']).maybeSingle();
  if (referrer?.id && referrer.id !== userId) await admin.from('profiles').update({ referred_by: referrer.id }).eq('id', userId);
}
