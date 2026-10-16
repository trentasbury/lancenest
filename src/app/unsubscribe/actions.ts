'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyUnsubscribe } from '@/lib/emailLinks';

/** Confirms an unsubscribe from a signed email link (no sign-in needed). */
export async function confirmUnsubscribe(formData: FormData) {
  const u = String(formData.get('u') ?? '');
  const l = String(formData.get('l') ?? '');
  const t = String(formData.get('t') ?? '');
  if (!verifyUnsubscribe(u, l, t)) redirect('/unsubscribe?invalid=1');
  if (l === 'digest') await createAdminClient().from('profiles').update({ email_digest: false }).eq('id', u);
  redirect('/unsubscribe?done=1');
}
