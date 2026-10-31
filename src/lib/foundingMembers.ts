import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE, notifyMember } from '@/lib/email';
import { FOUNDING_MEMBER } from '@/lib/stripe';

const DAY = 86400000;

/** How many of the 100 Founding Member seats are still open. */
export async function foundingMemberSeatsLeft() {
  const { count } = await createAdminClient().from('founding_members').select('profile_id', { count: 'exact', head: true });
  return Math.max(FOUNDING_MEMBER.spots - (count ?? 0), 0);
}

export async function isFoundingMember(profileId: string) {
  const { data } = await createAdminClient().from('founding_members').select('seat').eq('profile_id', profileId).maybeSingle();
  return Boolean(data);
}

/**
 * The first 100 verified members (service members, veterans and spouses) become Founding Members: 6 months of Pro
 * free, then $99 for their first year of Pro on the annual plan. Called when a member is verified. Safe to call any
 * time: it does nothing for anyone unverified, anyone who already has a seat, or once the 100 seats are gone
 * (the database refuses a 101st seat even if two approvals happen at once).
 */
export async function grantFoundingMember(profileId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: v } = await admin.from('veteran_profiles').select('verification_status, granted_plan, pro_granted_until').eq('profile_id', profileId).maybeSingle();
  if (!v || v.verification_status !== 'verified') return false;
  if (await isFoundingMember(profileId)) return false;
  // The first open seat number (a seat frees up if its member deletes their account). If two approvals land at
  // once and pick the same seat, the database refuses the second and it tries the next open seat.
  let seat = 0;
  for (let attempt = 0; attempt < 3 && !seat; attempt++) {
    const { data: taken } = await admin.from('founding_members').select('seat');
    const used = new Set((taken ?? []).map((r) => r.seat as number));
    const open = Array.from({ length: FOUNDING_MEMBER.spots }, (_, i) => i + 1).find((n) => !used.has(n));
    if (!open) return false;
    const { error } = await admin.from('founding_members').insert({ profile_id: profileId, seat: open });
    if (!error) seat = open;
    else if (error.code !== '23505' || (await isFoundingMember(profileId))) return false;
  }
  if (!seat) return false;

  // 6 months of Pro from today. It doesn't stack with another free Pro period (e.g. Transition Pro): whichever
  // ends later wins.
  const now = Date.now();
  const active = v.granted_plan && v.pro_granted_until && Date.parse(v.pro_granted_until as string) > now;
  const until = Math.max(active ? Date.parse(v.pro_granted_until as string) : 0, now + FOUNDING_MEMBER.freeDays * DAY);
  await admin.from('veteran_profiles').update({
    granted_plan: active ? v.granted_plan : 'pro',
    pro_granted_until: new Date(until).toISOString(),
  }).eq('profile_id', profileId);
  const { recomputeVeteran } = await import('@/lib/billing');
  await recomputeVeteran(profileId);
  await notifyMember(profileId, {
    type: 'plan', link: '/plans',
    title: `You’re Founding Member #${seat}: 6 months of LanceNest Pro free, then $99 for your first year.`,
    email: {
      subject: `Founding Member #${seat}: 6 months of Pro, on us`, preheader: 'One of the first 100 verified members on LanceNest.', tone: 'success', badge: 'Founding Member',
      heading: `Welcome aboard, Founding Member #${seat}.`,
      paragraphs: [
        'You’re one of the first 100 verified members on LanceNest, so Pro is on us for 6 months. No card needed.',
        'When it ends, you can keep Pro for $99 for your first year on the annual plan (normally $199). After that it renews at the standard price, and you can cancel anytime.',
        'Built by veterans, for veterans. Thank you for helping us build it.',
      ],
      cta: { label: 'See what Pro includes', url: `${SITE}/plans` },
    },
  });
  return true;
}
