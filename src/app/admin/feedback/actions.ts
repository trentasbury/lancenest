'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, SITE } from '@/lib/email';
import { STATUSES } from '@/app/help/kinds';

/** Admin: set a request's status and (optionally) reply. A new reply notifies the member, or emails a signed-out sender. */
export async function updateSupportRequest(id: string, back: string, formData: FormData) {
  await requireAdmin('/admin/feedback');
  const admin = createAdminClient();
  const statusRaw = String(formData.get('status') ?? '');
  const status = STATUSES.some(([v]) => v === statusRaw) ? statusRaw : 'new';
  const reply = String(formData.get('reply') ?? '').trim().slice(0, 2000) || null;

  const { data: before } = await admin.from('support_requests').select('profile_id, email, subject, admin_reply').eq('id', id).maybeSingle();
  if (!before) redirect(back);
  await admin.from('support_requests').update({ status, admin_reply: reply, updated_at: new Date().toISOString() }).eq('id', id);

  if (reply && reply !== before.admin_reply) {
    if (before.profile_id) {
      await admin.from('notifications').insert({ profile_id: before.profile_id, type: 'support', title: `We replied to “${before.subject}”`, link: '/help#requests' });
    } else if (before.email) {
      await sendEmail(before.email as string, {
        subject: `Re: ${before.subject}`, preheader: 'A reply from LanceNest', tone: 'notice', badge: 'Support',
        heading: `Re: ${before.subject}`, paragraphs: [reply, 'Reply to this email if you need anything else.'],
        cta: { label: 'Visit LanceNest', url: SITE },
      });
    }
  }
  revalidatePath('/admin/feedback');
  redirect(back);
}
