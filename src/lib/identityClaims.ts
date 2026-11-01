import 'server-only';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * One-time perks follow the verified person, not the account: deleting an account and joining again doesn't unlock
 * Founding Member, Transition Pro or a partner card a second time. The key is the identity fingerprint recorded when
 * the member was verified (name + date of birth, hashed; nothing readable). Members verified before fingerprints
 * existed fall back to their account.
 */
export type Perk = 'founding_member' | 'transition_pro' | 'partner_code' | 'founding_employer';

export async function identityKey(profileId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.from('verified_identities').select('identity_hash').eq('profile_id', profileId).maybeSingle();
  if (data?.identity_hash) return data.identity_hash as string;
  // A spouse verified through their service member's invite has no fingerprint of their own: the perk is tied to the
  // service member who vouched for them (so a new spouse account from the same invite-er can't claim it again).
  const { data: link } = await admin.from('spouse_links').select('sponsor_id, method').eq('spouse_id', profileId).maybeSingle();
  if (link?.method === 'sponsor_invite' && link.sponsor_id && link.sponsor_id !== profileId) {
    const { data: s } = await admin.from('verified_identities').select('identity_hash').eq('profile_id', link.sponsor_id as string).maybeSingle();
    return `spouse_of:${(s?.identity_hash as string | undefined) ?? `profile:${link.sponsor_id as string}`}`;
  }
  return `profile:${profileId}`;
}

/** A company's founding discount is claimed by its verified website domain. */
export function domainKey(website: string | null | undefined) {
  let host = '';
  try { host = new URL(String(website ?? '')).hostname.replace(/^www\./, '').toLowerCase(); } catch { host = ''; }
  return host ? `domain:${createHash('sha256').update(host).digest('hex')}` : null;
}

export async function alreadyClaimed(key: string, perk: Perk) {
  const { data } = await createAdminClient().from('identity_claims').select('perk').eq('identity_hash', key).eq('perk', perk).maybeSingle();
  return Boolean(data);
}

/** Records the claim. Returns false if this person (or domain) already claimed the perk. */
export async function claimPerk(key: string, perk: Perk, profileId: string | null) {
  const { error } = await createAdminClient().from('identity_claims').insert({ identity_hash: key, perk, profile_id: profileId });
  if (!error) return true;
  if (error.code !== '23505') console.error('claimPerk failed:', error.message);
  return false;
}

/** Undo a claim when the perk couldn't be given after all (e.g. the last seat went to someone else). */
export async function releasePerk(key: string, perk: Perk) {
  await createAdminClient().from('identity_claims').delete().eq('identity_hash', key).eq('perk', perk);
}
