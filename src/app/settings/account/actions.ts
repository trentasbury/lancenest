'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import { deleteMemberCompletely } from '@/lib/account';
import { createClient } from '@/lib/supabase/server';
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
