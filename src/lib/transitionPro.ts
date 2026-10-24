import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE, notifyMember } from '@/lib/email';

/** Free Pro for people leaving the service: LanceNest's answer to LinkedIn's free year of Premium for veterans. */
export const TRANSITION_PRO_DAYS = 90;
const DAY = 86400000;

/**
 * Gives a verified service member 90 days of Pro, once, when their separation date is within the next 12 months
 * (or in the last 90 days). Safe to call any time: it does nothing for anyone else or for anyone who already had it.
 * The separation date is self-reported, so the grant is one per verified account.
 */
export async function grantTransitionPro(profileId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: v } = await admin.from('veteran_profiles')
    .select('verification_status, separation_date, member_type, granted_plan, pro_granted_until')
    .eq('profile_id', profileId).maybeSingle();
  if (!v || v.verification_status !== 'verified' || !v.separation_date) return false;
  if ((v.member_type ?? 'service_member') !== 'service_member') return false;
  const sep = Date.parse(`${v.separation_date as string}T00:00:00Z`);
  const now = Date.now();
  if (!(sep >= now - 90 * DAY && sep <= now + 365 * DAY)) return false;

  // Claim it first (one row per member), so two calls at once, or a second separation date, can't grant it again.
  const { error: claimed } = await admin.from('member_grants').insert({ profile_id: profileId, kind: 'transition_pro' });
  if (claimed) return false;

  const active = v.granted_plan && v.pro_granted_until && Date.parse(v.pro_granted_until as string) > now;
  const base = active ? Date.parse(v.pro_granted_until as string) : now;
  await admin.from('veteran_profiles').update({
    granted_plan: active ? v.granted_plan : 'pro',
    pro_granted_until: new Date(base + TRANSITION_PRO_DAYS * DAY).toISOString(),
  }).eq('profile_id', profileId);
  const { recomputeVeteran } = await import('@/lib/billing');
  await recomputeVeteran(profileId);
  await notifyMember(profileId, {
    type: 'plan', link: '/plans',
    title: `Thank you for your service. You have ${TRANSITION_PRO_DAYS} days of LanceNest Pro, free, for your transition.`,
    email: {
      subject: `${TRANSITION_PRO_DAYS} days of LanceNest Pro, on us`, preheader: 'Free Pro for your transition. No card needed.', tone: 'success', badge: 'Free Pro',
      heading: 'Your transition, with Pro.',
      paragraphs: [
        `You’re leaving the service soon, so we’ve turned on ${TRANSITION_PRO_DAYS} days of LanceNest Pro for you. No card, nothing to cancel.`,
        'Pro shows how you compare with other applicants, puts your profile in front of employers hiring people who are separating, and unlocks the résumé tools.',
      ],
      cta: { label: 'See what’s included', url: `${SITE}/plans` },
    },
  });
  return true;
}
