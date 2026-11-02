'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { roleHome, safeNextPath } from '@/lib/auth';
import { NAV_COOKIE, navCookieOptions, navRoleFor } from '@/lib/session';
import { makeEmployerIfNew, makeSpouseIfNew } from '@/lib/oauth';
import { recordTermsAcceptance } from '@/lib/platformAgreement';
import type { Role } from '@/lib/types';

/**
 * One-time choice for a brand-new Google account: stay a service member account, or switch to an employer account.
 * Includes the Terms box (like Upwork's sign-up), recorded with its wording version and time.
 */
export async function chooseAccountType(nextRaw: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const raw = String(formData.get('type') ?? '');
  const choice = (['veteran', 'spouse', 'employer', 'client'] as const).find((c) => c === raw);
  const next = safeNextPath(nextRaw);
  if (!choice || formData.get('terms') !== 'on') redirect(`/account-setup?choose=1&error=1${next ? `&next=${encodeURIComponent(next)}` : ''}`);
  if (choice === 'employer') await makeEmployerIfNew(user.id, user.created_at);
  if (choice === 'client') await makeEmployerIfNew(user.id, user.created_at, 'client');
  if (choice === 'spouse') await makeSpouseIfNew(user.id, user.created_at);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = (profile?.role as Role | undefined) ?? null;
  await recordTermsAcceptance(user.id, role);
  (await cookies()).set(NAV_COOKIE, navRoleFor(role), navCookieOptions);
  redirect(next ?? roleHome(role));
}
