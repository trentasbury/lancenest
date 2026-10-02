'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyMember, SITE } from '@/lib/email';

export async function addCandidate(requestId: string, formData: FormData) {
  await requireAdmin('/admin/shortlists');
  const admin = createAdminClient();
  const username = String(formData.get('username') ?? '').trim().replace(/^.*\/veterans\//, '').replace(/\/$/, '');
  const { data: p } = await admin.from('profiles').select('id, role').eq('username', username).maybeSingle();
  if (!p || !['veteran', 'admin'].includes(p.role as string)) redirect('/admin/shortlists?error=member');
  await admin.from('shortlist_candidates').upsert({ request_id: requestId, profile_id: p.id, note: String(formData.get('note') ?? '').trim().slice(0, 1000) || null });
  revalidatePath('/admin/shortlists');
}
export async function removeCandidate(requestId: string, profileId: string) {
  await requireAdmin('/admin/shortlists');
  await createAdminClient().from('shortlist_candidates').delete().eq('request_id', requestId).eq('profile_id', profileId);
  revalidatePath('/admin/shortlists');
}
export async function deliverShortlist(requestId: string) {
  await requireAdmin('/admin/shortlists');
  const admin = createAdminClient();
  const { data: r } = await admin.from('shortlist_requests').select('role_title, requested_by').eq('id', requestId).maybeSingle();
  await admin.from('shortlist_requests').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', requestId);
  if (r?.requested_by) await notifyMember(r.requested_by as string, { type: 'shortlist', link: '/employer/shortlists', title: `Your Verified Shortlist for “${r.role_title}” is ready.`,
    email: { subject: `Your shortlist is ready: ${r.role_title}`, preheader: 'Verified, interested candidates — ready to talk.', tone: 'success', badge: 'Shortlist',
      heading: 'Your Verified Shortlist is ready.', paragraphs: [`We’ve hand-picked verified service members for “${r.role_title}” who’ve confirmed interest and availability.`, 'Message them directly from your shortlist. If none fit, request a free re-run.'],
      cta: { label: 'See your candidates', url: `${SITE}/employer/shortlists` } } });
  revalidatePath('/admin/shortlists');
}
export async function closeShortlist(requestId: string) {
  await requireAdmin('/admin/shortlists');
  await createAdminClient().from('shortlist_requests').update({ status: 'closed' }).eq('id', requestId);
  revalidatePath('/admin/shortlists');
}
