'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole, requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function saveTransition(formData: FormData) {
  const { user } = await requireRole(['veteran'], '/transition');
  const date = String(formData.get('separation_date') ?? '');
  await (await createClient()).from('veteran_profiles').update({
    separation_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    open_to_transition_hiring: formData.get('open_to_transition_hiring') === 'on',
    skillbridge_interest: formData.get('skillbridge_interest') === 'on',
  }).eq('profile_id', user.id);
  // Free transition Pro only follows a date a reviewer confirmed; this turns it on if one is already on file.
  const { grantTransitionPro } = await import('@/lib/transitionPro');
  const granted = await grantTransitionPro(user.id);
  revalidatePath('/transition');
  redirect(granted ? '/transition?saved=1&pro=1' : '/transition?saved=1');
}

/**
 * A verified service member sends proof of their separation, ETS or retirement date. The file is already in their
 * own private folder; this checks it's theirs and opens one review at a time.
 */
export async function submitSeparationCheck(formData: FormData) {
  const { user, profile } = await requireVerifiedMember('/transition');
  if (profile.role !== 'veteran') redirect('/transition');
  const date = String(formData.get('requested_date') ?? '');
  const path = String(formData.get('document_path') ?? '');
  const supabase = await createClient();
  const drop = async () => { if (path.startsWith(`${user.id}/`)) await supabase.storage.from('verification-docs').remove([path]); };

  const admin = createAdminClient();
  const { data: v } = await admin.from('veteran_profiles').select('member_type, verification_status').eq('profile_id', user.id).maybeSingle();
  if (v?.verification_status !== 'verified' || (v?.member_type ?? 'service_member') !== 'service_member') { await drop(); redirect('/transition?sep=not_eligible'); }
  const when = Date.parse(`${date}T00:00:00Z`);
  const DAY = 86400000;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(when) || when < Date.now() - 2 * 365 * DAY || when > Date.now() + 3 * 365 * DAY) { await drop(); redirect('/transition?sep=date'); }
  if (!new RegExp(`^${user.id}/\\d+-separation\\.(pdf|jpg|png)$`).test(path)) redirect('/transition?sep=file');
  const { data: files } = await supabase.storage.from('verification-docs').list(user.id, { limit: 200 });
  if (!(files ?? []).some((f) => `${user.id}/${f.name}` === path)) redirect('/transition?sep=file');

  // Three tries a month is plenty for a real date change; more is someone shopping for an approval.
  const { count: recent } = await admin.from('separation_checks').select('id', { count: 'exact', head: true }).eq('profile_id', user.id).gte('created_at', new Date(Date.now() - 30 * DAY).toISOString());
  if ((recent ?? 0) >= 3) { await drop(); redirect('/transition?sep=limit'); }
  const { error } = await admin.from('separation_checks').insert({ profile_id: user.id, requested_date: date, document_path: path });
  if (error) { await drop(); redirect(error.code === '23505' ? '/transition?sep=pending' : '/transition?sep=save'); }
  // Keep the self-reported date in step so the timeline matches what they sent.
  await admin.from('veteran_profiles').update({ separation_date: date }).eq('profile_id', user.id);
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  if (admins?.length) await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'verification', title: 'A separation date is waiting for review', link: '/admin/verifications' })));
  revalidatePath('/transition');
  redirect('/transition?sep=sent');
}
