import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE, notifyMember } from '@/lib/email';

/**
 * Partner Pro codes: transition offices, veterans' groups and nonprofits hand these out, the way LinkedIn gives its
 * free year of Premium through Hire Heroes USA and others. One code per verified member, ever.
 */
const DAY = 86400000;
export type RedeemResult = 'ok' | 'invalid' | 'used_up' | 'already' | 'too_many' | 'unverified' | 'error';

const REASONS: Record<number, RedeemResult> = { [-1]: 'too_many', [-2]: 'already', [-3]: 'invalid', [-4]: 'used_up' };

export async function redeemPartnerCode(profileId: string, raw: string): Promise<RedeemResult> {
  const code = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9-]{4,32}$/.test(code)) return 'invalid';
  const admin = createAdminClient();
  const { data: v } = await admin.from('veteran_profiles').select('verification_status, granted_plan, pro_granted_until').eq('profile_id', profileId).maybeSingle();
  if (v?.verification_status !== 'verified') return 'unverified';
  const { data, error } = await admin.rpc('redeem_partner_code', { p_profile: profileId, p_code: code });
  if (error) return error.code === '23505' ? 'already' : 'error';
  const months = Number(data);
  if (!(months > 0)) return REASONS[months] ?? 'error';
  const now = Date.now();
  const active = v.granted_plan && v.pro_granted_until && Date.parse(v.pro_granted_until as string) > now;
  const base = active ? Date.parse(v.pro_granted_until as string) : now;
  await admin.from('veteran_profiles').update({
    granted_plan: active ? v.granted_plan : 'pro',
    pro_granted_until: new Date(base + Number(months) * 30 * DAY).toISOString(),
  }).eq('profile_id', profileId);
  const { recomputeVeteran } = await import('@/lib/billing');
  await recomputeVeteran(profileId);
  await notifyMember(profileId, { type: 'plan', link: '/plans', title: `Your partner code added ${months} months of LanceNest Pro. No card needed.` });
  return 'ok';
}

export const REDEEM_MESSAGES: Record<RedeemResult, string> = {
  ok: 'Done. Pro is on for your account.',
  invalid: 'That code isn’t valid or has expired. Check it with the organization that gave it to you.',
  used_up: 'That code has been used the maximum number of times.',
  already: 'Your account has already used a partner code.',
  too_many: 'Too many tries today. Please try again tomorrow.',
  unverified: 'Partner codes work once your service is verified.',
  error: 'That didn’t work. Please try again.',
};

export function partnerSignupUrl(code: string) {
  return `${SITE}/signup?role=veteran&partner=${encodeURIComponent(code)}`;
}
