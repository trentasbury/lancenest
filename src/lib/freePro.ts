import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { alreadyClaimed, identityKey } from '@/lib/identityClaims';

/**
 * The one member offer (approved November 6, 2026): 6 months of Pro free, once per person. There are three ways in
 * (one of the first 500 verified members, a partner card, or leaving the service within a year), and whichever comes
 * first is the only one: the others don't add more time, and free periods never stack.
 */
export const FREE_PRO_DAYS = 180;
export const FREE_PRO_LENGTH = '6 months';
export const FOUNDING_MEMBER_SEATS = 500;

/** True once this person (on any account) has had the free Pro period, by any of the three ways in. */
export async function hadFreePro(profileId: string): Promise<boolean> {
  const admin = createAdminClient();
  const [{ count: seat }, { count: grant }, { count: card }] = await Promise.all([
    admin.from('founding_members').select('profile_id', { count: 'exact', head: true }).eq('profile_id', profileId),
    admin.from('member_grants').select('profile_id', { count: 'exact', head: true }).eq('profile_id', profileId).eq('kind', 'transition_pro'),
    admin.from('partner_redemptions').select('profile_id', { count: 'exact', head: true }).eq('profile_id', profileId),
  ]);
  if ((seat ?? 0) + (grant ?? 0) + (card ?? 0) > 0) return true;
  const key = await identityKey(profileId);
  for (const perk of ['founding_member', 'transition_pro', 'partner_code'] as const) {
    if (await alreadyClaimed(key, perk)) return true;
  }
  return false;
}
