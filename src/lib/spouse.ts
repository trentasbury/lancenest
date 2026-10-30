import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE, notifyMember } from '@/lib/email';

/**
 * Military spouses verify one of two ways: documents reviewed by a person (like service members), or an invite link
 * from their verified service member. The link is one-time, lasts 14 days, and each service member can have one
 * linked spouse at a time. Admins are told about every spouse verified this way.
 */
export const SPOUSE_INVITE_COOKIE = 'ln_spouse_invite';
const DAY = 86400000;
const YEAR = 365 * DAY;
/** After a link lapses or the service member removes it, the spouse keeps their status this long to re-verify. */
export const SPOUSE_GRACE_DAYS = 90;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

type Sponsor = { ok: true; firstName: string } | { ok: false; reason: 'not_verified' | 'is_spouse' | 'linked' | 'limit' };

async function sponsorCheck(sponsorId: string): Promise<Sponsor> {
  const admin = createAdminClient();
  const [{ data: v }, { data: p }, { count: linked }, { count: recent }, { count: usedThisYear }] = await Promise.all([
    admin.from('veteran_profiles').select('verification_status, member_type').eq('profile_id', sponsorId).maybeSingle(),
    admin.from('profiles').select('full_name, banned, suspended_until').eq('id', sponsorId).maybeSingle(),
    // A removed spouse no longer points at the sponsor, so only the current link counts here.
    admin.from('spouse_links').select('spouse_id', { count: 'exact', head: true }).eq('sponsor_id', sponsorId),
    admin.from('spouse_invites').select('id', { count: 'exact', head: true }).eq('sponsor_id', sponsorId).gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
    // Two spouses verified by invite in a year is the most anyone needs; more goes to a person (documents).
    admin.from('spouse_invites').select('id', { count: 'exact', head: true }).eq('sponsor_id', sponsorId).not('used_at', 'is', null).gte('used_at', new Date(Date.now() - 365 * 86400000).toISOString()),
  ]);
  if (v?.verification_status !== 'verified' || !p || p.banned || (p.suspended_until && Date.parse(p.suspended_until as string) > Date.now())) return { ok: false, reason: 'not_verified' };
  if (v.member_type === 'spouse') return { ok: false, reason: 'is_spouse' };
  if ((linked ?? 0) > 0) return { ok: false, reason: 'linked' };
  if ((recent ?? 0) >= 3 || (usedThisYear ?? 0) >= 2) return { ok: false, reason: 'limit' };
  return { ok: true, firstName: String(p.full_name ?? '').split(' ')[0] || 'your service member' };
}

/** A new invite link for a verified service member (older unused links stop working). */
export async function createSpouseInvite(sponsorId: string): Promise<{ url: string } | { error: string }> {
  const check = await sponsorCheck(sponsorId);
  if (!check.ok) return { error: check.reason };
  const admin = createAdminClient();
  await admin.from('spouse_invites').update({ expires_at: new Date().toISOString() }).eq('sponsor_id', sponsorId).is('used_at', null);
  const token = randomBytes(24).toString('base64url');
  const { error } = await admin.from('spouse_invites').insert({ sponsor_id: sponsorId, token_hash: hash(token) });
  if (error) return { error: 'failed' };
  return { url: `${SITE}/spouse/accept?t=${token}` };
}

/** Who sent the invite (first name only), if the link is still good. Used to show "Accept the invite from Jordan". */
export async function peekSpouseInvite(token: string | undefined): Promise<{ firstName: string } | null> {
  if (!token || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const admin = createAdminClient();
  const { data: inv } = await admin.from('spouse_invites').select('sponsor_id, expires_at, used_at').eq('token_hash', hash(token)).maybeSingle();
  if (!inv || inv.used_at || Date.parse(inv.expires_at as string) < Date.now()) return null;
  const check = await sponsorCheck(inv.sponsor_id as string);
  return check.ok ? { firstName: check.firstName } : null;
}

/** The spouse accepts. Verifies the spouse account and links it to the service member. */
export async function acceptSpouseInvite(spouseId: string, token: string | undefined): Promise<'ok' | 'invalid' | 'not_spouse' | 'already' | 'self'> {
  if (!token || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) return 'invalid';
  const admin = createAdminClient();
  const { data: me } = await admin.from('veteran_profiles').select('member_type, verification_status').eq('profile_id', spouseId).maybeSingle();
  if (me?.member_type !== 'spouse') return 'not_spouse';
  // Already verified: only a spouse whose status is ending (grace period) can renew with a new invite.
  const renewing = me.verification_status === 'verified';
  if (renewing && (await spouseLinkState(spouseId)).state !== 'grace') return 'already';
  const { data: inv } = await admin.from('spouse_invites').select('id, sponsor_id, expires_at, used_at').eq('token_hash', hash(token)).maybeSingle();
  if (!inv || inv.used_at || Date.parse(inv.expires_at as string) < Date.now()) return 'invalid';
  if (inv.sponsor_id === spouseId) return 'self';
  const check = await sponsorCheck(inv.sponsor_id as string);
  if (!check.ok) return 'invalid';

  // Use the link once: only one caller can claim it.
  const { data: claimed } = await admin.from('spouse_invites').update({ used_by: spouseId, used_at: new Date().toISOString() })
    .eq('id', inv.id).is('used_at', null).select('id').maybeSingle();
  if (!claimed) return 'invalid';
  const link = { spouse_id: spouseId, sponsor_id: inv.sponsor_id, method: 'sponsor_invite', linked_at: new Date().toISOString(), confirmed_until: new Date(Date.now() + YEAR).toISOString(), grace_until: null, reminded_at: null };
  const { error } = renewing
    ? await admin.from('spouse_links').upsert(link, { onConflict: 'spouse_id' })
    : await admin.from('spouse_links').insert(link);
  if (error) return 'already';
  // The verification record (its database trigger turns on the Verified badge).
  await admin.from('verification_requests').insert({ profile_id: spouseId, status: 'verified', method: 'sponsor_invite', notes: renewing ? 'Renewed through their service member’s invite' : 'Verified through their service member’s invite', reviewed_at: new Date().toISOString() });
  if (renewing) {
    await notifyMember(inv.sponsor_id as string, { type: 'verification', link: '/dashboard/spouse', title: 'Your spouse accepted your invite. Their military spouse status is renewed for a year.' });
    await notifyMember(spouseId, { type: 'verification', link: '/dashboard', title: `${check.firstName} confirmed you. Your military spouse status is renewed for a year.` });
    return 'ok';
  }

  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  if (admins?.length) await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'verification', title: 'A military spouse was verified through their service member’s invite. Review it if anything looks off.', link: '/admin/verifications' })));
  await notifyMember(inv.sponsor_id as string, { type: 'verification', link: '/dashboard/spouse', title: 'Your spouse accepted your invite and is now a verified LanceNest member.' });
  await notifyMember(spouseId, { type: 'verification', link: '/dashboard', title: 'You’re verified ✓ — jobs, the network, messaging, and freelance are unlocked.',
    email: { subject: 'You’re verified on LanceNest', preheader: 'Jobs, the network, messaging, and freelance are now unlocked.', tone: 'success', badge: '✓ Verified military spouse',
      heading: 'Welcome aboard — you’re verified.',
      paragraphs: [`${check.firstName} confirmed you on LanceNest, so your account is verified. Jobs, the Network, messaging, and freelance work are all unlocked.`,
        'Next step: fill in your profile. Remote and portable roles are easiest to find from the Jobs page with “Remote” selected.'],
      cta: { label: 'Go to your dashboard', url: `${SITE}/dashboard` } } });
  return 'ok';
}

/** The service member's view: whether a spouse is linked, that spouse's name, and when the link next needs confirming. */
export async function mySpouse(sponsorId: string): Promise<{ name: string; username: string | null; confirmedUntil: string | null; graceUntil: string | null; surviving: boolean } | null> {
  const admin = createAdminClient();
  const { data } = await admin.from('spouse_links').select('confirmed_until, grace_until, surviving, spouse:profiles!spouse_links_spouse_id_fkey(full_name, username)').eq('sponsor_id', sponsorId).maybeSingle();
  const row = data as unknown as { confirmed_until: string | null; grace_until: string | null; surviving: boolean; spouse: { full_name: string; username: string | null } | null } | null;
  const s = row?.spouse;
  return s ? { name: s.full_name, username: s.username, confirmedUntil: row.confirmed_until, graceUntil: row.grace_until, surviving: row.surviving } : null;
}

export type SpouseLinkState = { state: 'none' | 'active' | 'due' | 'grace' | 'surviving'; confirmedUntil: string | null; graceUntil: string | null; viaSponsor: boolean };

/**
 * Where a verified spouse stands: confirmed (active), due within 30 days, in their 90-day grace period, or a
 * surviving spouse (never expires). Spouses verified before links existed show as 'none'.
 */
export async function spouseLinkState(spouseId: string): Promise<SpouseLinkState> {
  const { data: l } = await createAdminClient().from('spouse_links').select('sponsor_id, confirmed_until, grace_until, surviving').eq('spouse_id', spouseId).maybeSingle();
  if (!l) return { state: 'none', confirmedUntil: null, graceUntil: null, viaSponsor: false };
  const base = { confirmedUntil: l.confirmed_until as string | null, graceUntil: l.grace_until as string | null, viaSponsor: !!l.sponsor_id };
  if (l.surviving) return { ...base, state: 'surviving' };
  if (l.grace_until) return { ...base, state: 'grace' };
  if (l.confirmed_until && Date.parse(l.confirmed_until as string) < Date.now() + 30 * DAY) return { ...base, state: 'due' };
  return { ...base, state: 'active' };
}

/** The service member confirms their spouse is still their spouse: good for another year. */
export async function confirmSpouse(sponsorId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from('spouse_links').update({ confirmed_until: new Date(Date.now() + YEAR).toISOString(), grace_until: null, reminded_at: null })
    .eq('sponsor_id', sponsorId).select('spouse_id').maybeSingle();
  if (!data) return false;
  await notifyMember(data.spouse_id as string, { type: 'verification', link: '/dashboard', title: 'Your service member confirmed you. Your military spouse status is good for another year.' });
  return true;
}

/**
 * The service member removes their spouse (divorce, separation, or a mistake). The spouse keeps their status for the
 * grace period so they can verify with their own documents, then it ends. The sponsor can invite someone else.
 */
export async function removeSpouse(sponsorId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: l } = await admin.from('spouse_links').select('spouse_id, grace_until').eq('sponsor_id', sponsorId).maybeSingle();
  if (!l) return false;
  const graceEnd = Math.min(Date.now() + SPOUSE_GRACE_DAYS * DAY, l.grace_until ? Date.parse(l.grace_until as string) : Infinity);
  await admin.from('spouse_links').update({ sponsor_id: null, grace_until: new Date(graceEnd).toISOString() }).eq('spouse_id', l.spouse_id);
  await admin.from('admin_actions').insert({ admin_id: null, action: 'spouse_unlinked_by_sponsor', target_type: 'profile', target_id: l.spouse_id, details: { sponsor: sponsorId } });
  const ends = new Date(graceEnd).toLocaleDateString('en-US', { dateStyle: 'long' });
  await notifyMember(l.spouse_id as string, { type: 'verification', link: '/dashboard/verification',
    title: `Your service member removed your spouse link. Your military spouse status stays on until ${ends}; verify with your own documents before then to keep it.`,
    email: { subject: 'Your LanceNest spouse status is changing', preheader: `Verify with documents before ${ends} to keep your badge.`, tone: 'notice', badge: 'Action needed',
      heading: 'Your spouse link was removed.',
      paragraphs: [`The service member who invited you removed the link between your accounts. Your Verified military spouse status stays on until ${ends}.`,
        'To keep it, send documents for a person to review: orders listing you as a dependent, a DD Form 1172-2, or your marriage certificate with your spouse’s DD-214 or LES. Surviving spouses can send a VA survivor benefits letter.',
        'Your account, profile and messages stay yours either way.'],
      cta: { label: 'Verify with documents', url: `${SITE}/dashboard/verification` } } });
  return true;
}

/**
 * Daily: the yearly spouse check. A month before a link lapses, remind both people; when it lapses, start the grace
 * period; when the grace period ends, the spouse's verified status ends (unless renewal documents are in review).
 * Surviving spouses are never touched.
 */
export async function runSpouseChecks(): Promise<{ reminded: number; lapsed: number; ended: number }> {
  const admin = createAdminClient();
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const fmt = (d: string | number) => new Date(d).toLocaleDateString('en-US', { dateStyle: 'long' });
  let reminded = 0, lapsed = 0, ended = 0;

  // 1) Reminders, 30 days out.
  const { data: due } = await admin.from('spouse_links').select('spouse_id, sponsor_id, confirmed_until')
    .eq('surviving', false).is('grace_until', null).is('reminded_at', null).gt('confirmed_until', iso(now)).lte('confirmed_until', iso(now + 30 * DAY)).limit(500);
  for (const l of due ?? []) {
    const on = fmt(l.confirmed_until as string);
    if (l.sponsor_id) await notifyMember(l.sponsor_id as string, { type: 'verification', link: '/dashboard/spouse', title: `Please confirm your spouse on LanceNest by ${on}. It takes one click.` });
    await notifyMember(l.spouse_id as string, { type: 'verification', link: l.sponsor_id ? '/dashboard' : '/dashboard/verification',
      title: l.sponsor_id ? `Your military spouse status is due for its yearly check on ${on}. Your service member can confirm you from their dashboard.` : `Your military spouse status is due for its yearly check on ${on}. Send current documents to renew.` });
    await admin.from('spouse_links').update({ reminded_at: iso(now) }).eq('spouse_id', l.spouse_id);
    reminded++;
  }

  // 2) Lapsed: start the grace period.
  const { data: late } = await admin.from('spouse_links').select('spouse_id, sponsor_id')
    .eq('surviving', false).is('grace_until', null).lte('confirmed_until', iso(now)).limit(500);
  for (const l of late ?? []) {
    const until = now + SPOUSE_GRACE_DAYS * DAY;
    await admin.from('spouse_links').update({ grace_until: iso(until) }).eq('spouse_id', l.spouse_id);
    if (l.sponsor_id) await notifyMember(l.sponsor_id as string, { type: 'verification', link: '/dashboard/spouse', title: `Your spouse’s LanceNest status wasn’t confirmed. It ends on ${fmt(until)} unless you confirm.` });
    await notifyMember(l.spouse_id as string, { type: 'verification', link: '/dashboard/verification',
      title: `Your military spouse status ends on ${fmt(until)} unless it’s renewed.`,
      email: { subject: 'Renew your LanceNest military spouse status', preheader: `Your status ends on ${fmt(until)} unless it’s renewed.`, tone: 'notice', badge: 'Action needed',
        heading: 'Time for your yearly spouse check.',
        paragraphs: ['Military spouse status on LanceNest is confirmed once a year, so the badge stays meaningful for everyone.',
          l.sponsor_id ? 'Your service member can confirm you in one click from their dashboard (Dashboard → Invite your spouse). Or send current documents yourself.' : 'Send current documents to renew: orders listing you as a dependent, a DD Form 1172-2, or your marriage certificate with your spouse’s DD-214 or LES.',
          `If nothing changes by ${fmt(until)}, your verified status ends. Your account and profile stay yours.`],
        cta: { label: 'Renew now', url: `${SITE}/dashboard/verification` } } });
    lapsed++;
  }

  // 3) Grace over: end the verified status (skipped while renewal documents are waiting for a reviewer).
  const { data: over } = await admin.from('spouse_links').select('spouse_id').eq('surviving', false).not('grace_until', 'is', null).lte('grace_until', iso(now)).limit(500);
  for (const l of over ?? []) {
    const id = l.spouse_id as string;
    const { count: waiting } = await admin.from('verification_requests').select('id', { count: 'exact', head: true }).eq('profile_id', id).eq('status', 'pending');
    if ((waiting ?? 0) > 0) continue;
    await admin.from('veteran_profiles').update({ verification_status: 'not_verified' }).eq('profile_id', id).eq('member_type', 'spouse');
    await admin.from('profiles').update({ verified: false }).eq('id', id);
    await admin.from('spouse_links').delete().eq('spouse_id', id);
    await admin.from('admin_actions').insert({ admin_id: null, action: 'spouse_status_ended', target_type: 'profile', target_id: id, details: { reason: 'yearly check not renewed' } });
    await notifyMember(id, { type: 'verification', link: '/dashboard/verification',
      title: 'Your military spouse status has ended because it wasn’t renewed. Verify again any time to turn everything back on.' });
    ended++;
  }
  return { reminded, lapsed, ended };
}
