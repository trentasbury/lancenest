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
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

type Sponsor = { ok: true; firstName: string } | { ok: false; reason: 'not_verified' | 'is_spouse' | 'linked' | 'limit' };

async function sponsorCheck(sponsorId: string): Promise<Sponsor> {
  const admin = createAdminClient();
  const [{ data: v }, { data: p }, { count: linked }, { count: recent }] = await Promise.all([
    admin.from('veteran_profiles').select('verification_status, member_type').eq('profile_id', sponsorId).maybeSingle(),
    admin.from('profiles').select('full_name, banned, suspended_until').eq('id', sponsorId).maybeSingle(),
    admin.from('spouse_links').select('spouse_id', { count: 'exact', head: true }).eq('sponsor_id', sponsorId),
    admin.from('spouse_invites').select('id', { count: 'exact', head: true }).eq('sponsor_id', sponsorId).gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
  ]);
  if (v?.verification_status !== 'verified' || !p || p.banned || (p.suspended_until && Date.parse(p.suspended_until as string) > Date.now())) return { ok: false, reason: 'not_verified' };
  if (v.member_type === 'spouse') return { ok: false, reason: 'is_spouse' };
  if ((linked ?? 0) > 0) return { ok: false, reason: 'linked' };
  if ((recent ?? 0) >= 3) return { ok: false, reason: 'limit' };
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
  if (me.verification_status === 'verified') return 'already';
  const { data: inv } = await admin.from('spouse_invites').select('id, sponsor_id, expires_at, used_at').eq('token_hash', hash(token)).maybeSingle();
  if (!inv || inv.used_at || Date.parse(inv.expires_at as string) < Date.now()) return 'invalid';
  if (inv.sponsor_id === spouseId) return 'self';
  const check = await sponsorCheck(inv.sponsor_id as string);
  if (!check.ok) return 'invalid';

  // Use the link once: only one caller can claim it.
  const { data: claimed } = await admin.from('spouse_invites').update({ used_by: spouseId, used_at: new Date().toISOString() })
    .eq('id', inv.id).is('used_at', null).select('id').maybeSingle();
  if (!claimed) return 'invalid';
  const { error } = await admin.from('spouse_links').insert({ spouse_id: spouseId, sponsor_id: inv.sponsor_id, method: 'sponsor_invite' });
  if (error) return 'already';
  // The verification record (its database trigger turns on the Verified badge).
  await admin.from('verification_requests').insert({ profile_id: spouseId, status: 'verified', method: 'sponsor_invite', notes: 'Verified through their service member’s invite', reviewed_at: new Date().toISOString() });

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

/** The service member's view: whether a spouse is linked, and that spouse's name. */
export async function mySpouse(sponsorId: string): Promise<{ name: string; username: string | null } | null> {
  const admin = createAdminClient();
  const { data } = await admin.from('spouse_links').select('spouse:profiles!spouse_links_spouse_id_fkey(full_name, username)').eq('sponsor_id', sponsorId).maybeSingle();
  const s = (data as unknown as { spouse: { full_name: string; username: string | null } | null } | null)?.spouse;
  return s ? { name: s.full_name, username: s.username } : null;
}
