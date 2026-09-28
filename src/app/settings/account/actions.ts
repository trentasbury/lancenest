'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import { deleteMemberCompletely } from '@/lib/account';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { LAST_SEEN_COOKIE, SESSION_START_COOKIE } from '@/lib/session';

export async function deleteMyAccount(formData: FormData) {
  const session = await getSessionProfile();
  if (!session) redirect('/login');
  if (session.profile?.role === 'admin') redirect('/settings/account?error=admin');
  if (String(formData.get('confirm') ?? '').trim() !== 'DELETE' || formData.get('understand') !== 'on') {
    redirect('/settings/account?error=confirm');
  }
  try {
    await deleteMemberCompletely(session.user.id);
  } catch (err) {
    console.error('self-service deletion failed:', err);
    redirect('/settings/account?error=failed');
  }
  await createClient().auth.signOut({ scope: 'local' }).catch(() => undefined);
  cookies().getAll().filter((c) => c.name.startsWith('sb-')).forEach((c) => cookies().delete(c.name));
  cookies().delete(LAST_SEEN_COOKIE);
  cookies().delete(SESSION_START_COOKIE);
  redirect('/?deleted=1');
}

/** Ends every session on every device (e.g. after a suspicious sign-in). */
export async function signOutEverywhere() {
  const session = await getSessionProfile();
  if (!session) redirect('/login');
  await createClient().auth.signOut({ scope: 'global' }).catch(() => undefined);
  cookies().getAll().filter((c) => c.name.startsWith('sb-')).forEach((c) => cookies().delete(c.name));
  cookies().delete(LAST_SEEN_COOKIE);
  cookies().delete(SESSION_START_COOKIE);
  redirect('/login?reason=everywhere');
}

const PHOTO_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Profile photo for any account type. Stored in the member's own folder in the public avatars bucket. */
export async function uploadAvatar(formData: FormData) {
  const session = await getSessionProfile();
  if (!session) redirect('/login');
  const file = formData.get('photo');
  if (!(file instanceof File) || !PHOTO_TYPES[file.type]) redirect('/settings/account?photo=type');
  if (file.size > 2 * 1024 * 1024) redirect('/settings/account?photo=size');
  const supabase = createClient();
  const path = `${session.user.id}/avatar-${Date.now()}.${PHOTO_TYPES[file.type]}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type });
  if (error) redirect('/settings/account?photo=failed');
  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  await createAdminClient().from('profiles').update({ avatar_url: url }).eq('id', session.user.id);
  revalidatePath('/', 'layout');
  redirect('/settings/account?photo=saved');
}

export async function removeAvatar() {
  const session = await getSessionProfile();
  if (!session) redirect('/login');
  await createAdminClient().from('profiles').update({ avatar_url: null }).eq('id', session.user.id);
  revalidatePath('/', 'layout');
  redirect('/settings/account?photo=removed');
}

/** Name, headline, and location — available to every account type. */
export async function saveAccountProfile(formData: FormData) {
  const session = await getSessionProfile();
  if (!session) redirect('/login');
  const t = (k: string, max: number) => String(formData.get(k) ?? '').trim().slice(0, max);
  const fullName = t('full_name', 120);
  if (fullName.length < 2) redirect('/settings/account?profile=name');
  await createClient().from('profiles').update({ full_name: fullName, headline: t('headline', 140) || null, location: t('location', 120) || null }).eq('id', session.user.id);
  revalidatePath('/', 'layout');
  redirect('/settings/account?profile=saved');
}
