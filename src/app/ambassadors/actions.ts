'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin, requireVerifiedMember } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyMember } from '@/lib/email';

export async function applyAmbassador(formData: FormData) {
  const { user, profile } = await requireVerifiedMember('/ambassadors');
  if (profile.role !== 'veteran') redirect('/ambassadors');
  const installation = String(formData.get('installation') ?? '').trim().slice(0, 120);
  const note = String(formData.get('role_note') ?? '').trim().slice(0, 300) || null;
  if (installation.length < 2 || formData.get('rules') !== 'on') redirect('/ambassadors?error=1#apply');
  const admin = createAdminClient();
  const { data: existing } = await admin.from('ambassadors').select('status').eq('profile_id', user.id).maybeSingle();
  if (existing?.status === 'removed') redirect('/ambassadors?error=removed#apply');
  await admin.from('ambassadors').upsert({ profile_id: user.id, installation, role_note: note, status: existing?.status === 'active' ? 'active' : 'pending' }, { onConflict: 'profile_id' });
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  if (admins?.length && !existing) await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'ambassador', title: `New ambassador application: ${profile.full_name} (${installation})`, link: '/admin/ambassadors' })));
  revalidatePath('/ambassadors');
  redirect('/ambassadors?applied=1#apply');
}

export async function decideAmbassador(profileId: string, status: 'active' | 'removed') {
  const { user } = await requireAdmin('/admin/ambassadors');
  await createAdminClient().from('ambassadors').update({ status, decided_at: new Date().toISOString(), decided_by: user.id }).eq('profile_id', profileId);
  await notifyMember(profileId, { type: 'ambassador', link: '/ambassadors', title: status === 'active' ? 'You’re a LanceNest Ambassador. Your link and printable flyer are ready.' : 'Your LanceNest Ambassador status has ended. Your regular referral link still works.' });
  revalidatePath('/admin/ambassadors');
}
