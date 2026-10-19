'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { roleHome, safeNextPath } from '@/lib/auth';
import { NAV_COOKIE, navCookieOptions, navRoleFor } from '@/lib/session';
import { makeEmployerIfNew } from '@/lib/oauth';
import type { Role } from '@/lib/types';

/** One-time choice for a brand-new Google account: stay a service member account, or switch to an employer account. */
export async function chooseAccountType(choice: 'veteran' | 'employer', nextRaw: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (choice === 'employer') await makeEmployerIfNew(user.id, user.created_at);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = (profile?.role as Role | undefined) ?? null;
  cookies().set(NAV_COOKIE, navRoleFor(role), navCookieOptions);
  redirect(safeNextPath(nextRaw) ?? roleHome(role));
}
