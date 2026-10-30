import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE, sendEmail } from '@/lib/email';
import { unsubscribeLinks } from '@/lib/emailLinks';

/**
 * Admin announcements (events, news): an in-app notice to everyone in the audience, a phone notification for people
 * who turned those on, and an optional email sent in daily batches the email plan can handle. Members who
 * unsubscribed from updates never get the email.
 */
export const AUDIENCES = {
  everyone: 'Everyone',
  members: 'All members (service members and spouses)',
  service_members: 'Service members and veterans',
  spouses: 'Military spouses',
  employers: 'Employers',
  clients: 'Clients (people hiring freelancers)',
  state: 'Members in one state',
} as const;
export type Audience = keyof typeof AUDIENCES;
export type Announcement = { id: string; title: string; body: string | null; link: string | null; audience: Audience; state: string | null; email_cursor: string | null };

/** Recipient ids in id order, after a cursor, a page at a time. Banned and suspended accounts are left out later. */
async function page(a: Pick<Announcement, 'audience' | 'state'>, after: string | null, size: number): Promise<string[]> {
  const admin = createAdminClient();
  if (a.audience === 'service_members' || a.audience === 'spouses' || a.audience === 'state') {
    let q = admin.from('veteran_profiles').select('profile_id').order('profile_id').limit(size);
    if (a.audience === 'state') q = q.eq('state', a.state ?? '--');
    else q = q.eq('member_type', a.audience === 'spouses' ? 'spouse' : 'service_member');
    if (after) q = q.gt('profile_id', after);
    const { data } = await q;
    return (data ?? []).map((r) => r.profile_id as string);
  }
  let q = admin.from('profiles').select('id').order('id').limit(size);
  if (a.audience === 'members') q = q.eq('role', 'veteran');
  if (a.audience === 'employers') q = q.eq('role', 'employer');
  if (a.audience === 'clients') q = q.eq('role', 'client');
  if (after) q = q.gt('id', after);
  const { data } = await q;
  return (data ?? []).map((r) => r.id as string);
}

/** Leaves out removed and suspended accounts (and, for email, anyone who unsubscribed from updates). */
async function reachable(ids: string[], forEmail: boolean) {
  if (!ids.length) return [];
  const { data } = await createAdminClient().from('profiles').select('id, banned, suspended_until, email_digest').in('id', ids);
  const now = Date.now();
  return (data ?? []).filter((p) => !p.banned && !(p.suspended_until && Date.parse(p.suspended_until as string) > now) && (!forEmail || p.email_digest !== false)).map((p) => p.id as string);
}

/** In-app notices and phone notifications for the whole audience. Returns how many people it reached. */
export async function deliverAnnouncement(a: Announcement): Promise<{ recipients: number; pushed: number }> {
  const admin = createAdminClient();
  let after: string | null = null, recipients = 0, pushed = 0;
  const { sendPush, PUSH_ENABLED } = await import('@/lib/push');
  for (;;) {
    const batch = await page(a, after, 1000);
    if (!batch.length) break;
    after = batch[batch.length - 1];
    const ids = await reachable(batch, false);
    for (let i = 0; i < ids.length; i += 500) {
      await admin.from('notifications').insert(ids.slice(i, i + 500).map((id) => ({ profile_id: id, type: 'announcement', title: a.title, body: a.body, link: a.link ?? '/notifications' })));
    }
    recipients += ids.length;
    if (PUSH_ENABLED && ids.length) {
      const { data: subs } = await admin.from('push_subscriptions').select('profile_id').in('profile_id', ids).limit(5000);
      const withPush = [...new Set((subs ?? []).map((s) => s.profile_id as string))];
      for (let i = 0; i < withPush.length; i += 10) {
        await Promise.all(withPush.slice(i, i + 10).map((id) => sendPush(id, { title: a.title, body: a.body ?? undefined, url: a.link?.startsWith('/') ? a.link : '/notifications', tag: 'announcement' }).catch(() => undefined)));
      }
      pushed += withPush.length;
    }
    if (batch.length < 1000) break;
  }
  return { recipients, pushed };
}

/** Daily: the next emails for announcements that asked for email, within a daily cap (Resend's free plan is 100 a day). */
export async function sendAnnouncementEmails(): Promise<number> {
  const admin = createAdminClient();
  let budget = Math.max(0, Number(process.env.ANNOUNCEMENT_EMAILS_PER_DAY ?? 60) || 0);
  let sent = 0;
  const { data: open } = await admin.from('announcements').select('id, title, body, link, audience, state, email_cursor, emailed').eq('email_done', false).order('created_at').limit(5);
  for (const a of (open ?? []) as (Announcement & { emailed: number })[]) {
    if (budget <= 0) break;
    let cursor = a.email_cursor;
    let done = false;
    let mine = 0;
    const url = a.link ? (a.link.startsWith('/') ? `${SITE}${a.link}` : a.link) : `${SITE}/notifications`;
    while (budget > 0 && !done) {
      const batch = await page(a, cursor, 100);
      if (!batch.length) { done = true; break; }
      const ok = new Set(await reachable(batch, true));
      for (const id of batch) {
        if (budget <= 0) break;
        cursor = id;
        if (!ok.has(id)) continue;
        const { data: u } = await admin.auth.admin.getUserById(id);
        if (!u?.user?.email) continue;
        await sendEmail(u.user.email, {
          subject: a.title, preheader: (a.body ?? a.title).slice(0, 110), tone: 'notice', badge: 'From LanceNest',
          heading: a.title, paragraphs: a.body ? [a.body] : [], cta: { label: a.link ? 'Learn more' : 'Open LanceNest', url },
          unsubscribe: { ...unsubscribeLinks(SITE, id, 'digest'), reason: 'You’re getting this as a LanceNest member.' },
        });
        budget--; sent++; mine++;
      }
      if (batch.length < 100 && cursor === batch[batch.length - 1]) done = true;
    }
    await admin.from('announcements').update({ email_cursor: cursor, email_done: done, emailed: a.emailed + mine }).eq('id', a.id);
  }
  return sent;
}
