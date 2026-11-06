import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE, notifyMember } from '@/lib/email';
import { claimPerk, identityKey } from '@/lib/identityClaims';
import { hadFreePro } from '@/lib/freePro';

/** Free Pro for people leaving the service: one of the three ways into the one member offer (lib/freePro.ts). */
export const TRANSITION_PRO_DAYS = 180;
const LENGTH = '6 months';
const DAY = 86400000;

/**
 * Gives a verified service member 6 months of Pro, once, when their separation date is within the next 12 months
 * (or in the last 90 days). Safe to call any time: it does nothing for anyone else or for anyone who already had it.
 * Only a separation date a reviewer confirmed from orders, an LES or a DD-214 counts (separation_verified_on);
 * the date members type in themselves never grants anything. One grant per verified person, ever.
 */
export async function grantTransitionPro(profileId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: v } = await admin.from('veteran_profiles')
    .select('verification_status, separation_verified_on, member_type, granted_plan, pro_granted_until')
    .eq('profile_id', profileId).maybeSingle();
  if (!v || v.verification_status !== 'verified' || !v.separation_verified_on) return false;
  if ((v.member_type ?? 'service_member') !== 'service_member') return false;
  const sep = Date.parse(`${v.separation_verified_on as string}T00:00:00Z`);
  const now = Date.now();
  if (!(sep >= now - 90 * DAY && sep <= now + 365 * DAY)) return false;

  // One free Pro period per person: a Founding Member seat or a partner card already counted (approved November 6, 2026).
  if (await hadFreePro(profileId)) return false;
  // Claim it first (one row per member), so two calls at once, or a second separation date, can't grant it again.
  const { error: claimed } = await admin.from('member_grants').insert({ profile_id: profileId, kind: 'transition_pro' });
  if (claimed) return false;
  // Once per person, not per account: deleting the account and joining again doesn't start another free period.
  if (!(await claimPerk(await identityKey(profileId), 'transition_pro', profileId))) return false;

  // Doesn't stack on another free period: whichever ends later wins.
  const active = v.granted_plan && v.pro_granted_until && Date.parse(v.pro_granted_until as string) > now;
  const until = Math.max(active ? Date.parse(v.pro_granted_until as string) : 0, now + TRANSITION_PRO_DAYS * DAY);
  await admin.from('veteran_profiles').update({
    granted_plan: active ? v.granted_plan : 'pro',
    pro_granted_until: new Date(until).toISOString(),
  }).eq('profile_id', profileId);
  const { recomputeVeteran } = await import('@/lib/billing');
  await recomputeVeteran(profileId);
  await notifyMember(profileId, {
    type: 'plan', link: '/plans',
    title: `Thank you for your service. You have ${LENGTH} of LanceNest Pro, free, for your transition.`,
    email: {
      subject: `${LENGTH} of LanceNest Pro, on us`, preheader: 'Free Pro for your transition. No card needed.', tone: 'success', badge: 'Free Pro',
      heading: 'Your transition, with Pro.',
      paragraphs: [
        `You’re leaving the service soon, so we’ve turned on ${LENGTH} of LanceNest Pro for you. No card, nothing to cancel.`,
        'Pro shows how you compare with other applicants, puts your profile in front of employers hiring people who are separating, and unlocks the résumé tools.',
      ],
      cta: { label: 'See what’s included', url: `${SITE}/plans` },
    },
  });
  return true;
}
