import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE, notifyMember } from '@/lib/email';

/**
 * Partner Pro codes: transition offices, veterans' groups and nonprofits hand these out, the way LinkedIn gives its
 * free year of Premium through Hire Heroes USA and others. One code per verified member, ever.
 */
const DAY = 86400000;
export type RedeemResult = 'ok' | 'invalid' | 'used_up' | 'already' | 'too_many' | 'unverified' | 'not_transitioning' | 'error';

const REASONS: Record<number, RedeemResult> = { [-1]: 'too_many', [-2]: 'already', [-3]: 'invalid', [-4]: 'used_up' };

/** Leaving the service: a reviewer-confirmed separation date within the next 12 months or the last 90 days. */
function isTransitioning(separationVerifiedOn: string | null | undefined) {
  if (!separationVerifiedOn) return false;
  const sep = Date.parse(`${separationVerifiedOn}T00:00:00Z`);
  const now = Date.now();
  return sep >= now - 90 * DAY && sep <= now + 365 * DAY;
}

export async function redeemPartnerCode(profileId: string, raw: string): Promise<RedeemResult> {
  const code = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9-]{4,32}$/.test(code)) return 'invalid';
  const admin = createAdminClient();
  const { data: v } = await admin.from('veteran_profiles').select('verification_status, granted_plan, pro_granted_until, separation_verified_on').eq('profile_id', profileId).maybeSingle();
  if (v?.verification_status !== 'verified') return 'unverified';
  // Cards for transition offices only work for members leaving the service (checked before the card is used up).
  const { data: pc } = await admin.from('partner_codes').select('transition_only, batch:partner_batches(voided_at)').eq('code', code).maybeSingle();
  if ((pc?.batch as unknown as { voided_at: string | null } | null)?.voided_at) return 'invalid';
  if (pc?.transition_only && !isTransitioning(v.separation_verified_on as string | null)) return 'not_transitioning';
  const { data, error } = await admin.rpc('redeem_partner_code', { p_profile: profileId, p_code: code });
  if (error) return error.code === '23505' ? 'already' : 'error';
  const months = Number(data);
  if (!(months > 0)) return REASONS[months] ?? 'error';
  // The code's months run from today. They don't stack on another free Pro period (Founding, Transition Pro):
  // whichever ends later wins (approved October 31, 2026).
  const now = Date.now();
  const active = v.granted_plan && v.pro_granted_until && Date.parse(v.pro_granted_until as string) > now;
  const until = Math.max(active ? Date.parse(v.pro_granted_until as string) : 0, now + Number(months) * 30 * DAY);
  await admin.from('veteran_profiles').update({
    granted_plan: active ? v.granted_plan : 'pro',
    pro_granted_until: new Date(until).toISOString(),
  }).eq('profile_id', profileId);
  const { recomputeVeteran } = await import('@/lib/billing');
  await recomputeVeteran(profileId);
  const ends = new Date(until).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  await notifyMember(profileId, { type: 'plan', link: '/plans', title: `Your partner code is applied: LanceNest Pro is free through ${ends}. No card needed.` });
  return 'ok';
}

export const REDEEM_MESSAGES: Record<RedeemResult, string> = {
  ok: 'Done. Pro is on for your account.',
  invalid: 'That code isn’t valid or has expired. Check it with the organization that gave it to you.',
  used_up: 'That code has already been used. Each card works once.',
  already: 'Your account has already used a partner code.',
  too_many: 'Too many tries today. Please try again tomorrow.',
  unverified: 'Partner codes work once your service is verified.',
  not_transitioning: 'This code is for members leaving the service within the next 12 months. Confirm your separation date in the Transition Hub (orders, an LES or a DD-214), then apply the code again. It isn’t used up.',
  error: 'That didn’t work. Please try again.',
};

export function partnerSignupUrl(code: string) {
  return `${SITE}/signup?role=veteran&partner=${encodeURIComponent(code)}`;
}
