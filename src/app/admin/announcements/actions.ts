'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { AUDIENCES, deliverAnnouncement, type Announcement, type Audience } from '@/lib/announcements';
import { US_STATES } from '@/lib/states';

const PAGE = '/admin/announcements';
const t = (f: FormData, k: string, max: number) => String(f.get(k) ?? '').trim().slice(0, max);

/** Sends an announcement now: in-app and phone right away, email (if chosen) in daily batches. */
export async function sendAnnouncement(formData: FormData) {
  const { user } = await requireAdmin(PAGE);
  const title = t(formData, 'title', 120);
  const body = t(formData, 'body', 600) || null;
  const link = t(formData, 'link', 300) || null;
  const audience = t(formData, 'audience', 20) as Audience;
  const state = audience === 'state' ? t(formData, 'state', 2).toUpperCase() : null;
  if (title.length < 4) redirect(`${PAGE}?error=title`);
  if (!Object.prototype.hasOwnProperty.call(AUDIENCES, audience)) redirect(`${PAGE}?error=audience`);
  if (audience === 'state' && !US_STATES.some(([c]) => c === state)) redirect(`${PAGE}?error=state`);
  if (link && !/^(\/[^/\\]|https:\/\/[^\s]+$)/.test(link)) redirect(`${PAGE}?error=link`);
  if (formData.get('confirm') !== 'on') redirect(`${PAGE}?error=confirm`);
  const sendEmailToo = formData.get('send_email') === 'on';

  const admin = createAdminClient();
  const { data: row, error } = await admin.from('announcements')
    .insert({ title, body, link, audience, state, send_email: sendEmailToo, email_done: !sendEmailToo, created_by: user.id })
    .select('id, title, body, link, audience, state, email_cursor').single();
  if (error || !row) { console.error('announcement insert failed:', error?.message); redirect(`${PAGE}?error=save`); }
  const { recipients, pushed } = await deliverAnnouncement(row as Announcement);
  await admin.from('announcements').update({ recipients, pushed }).eq('id', row.id);
  await admin.from('admin_actions').insert({ admin_id: user.id, action: 'announcement_sent', target_type: 'announcement', target_id: row.id, details: { audience, state, recipients, email: sendEmailToo } });
  revalidatePath(PAGE);
  redirect(`${PAGE}?sent=${recipients}`);
}

/** Stops any emails not yet sent for an announcement (the in-app notices stay). */
export async function stopAnnouncementEmails(id: string) {
  const { user } = await requireAdmin(PAGE);
  const admin = createAdminClient();
  await admin.from('announcements').update({ email_done: true }).eq('id', id);
  await admin.from('admin_actions').insert({ admin_id: user.id, action: 'announcement_email_stopped', target_type: 'announcement', target_id: id, details: {} });
  revalidatePath(PAGE);
}
