import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { roleHome, safeNextPath } from '@/lib/auth';
import { LAST_SEEN_COOKIE, NAV_COOKIE, SESSION_START_COOKIE, navCookieOptions, navRoleFor, sessionCookieOptions } from '@/lib/session';
import { recordLogin } from '@/lib/devices';
import { applyReferral, isFreshAccount, makeEmployerIfNew, makeSpouseIfNew } from '@/lib/oauth';
import type { Role } from '@/lib/types';

/** Handles email-confirmation and password-reset links, and the return from "Continue with Google" (PKCE code exchange). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      let dest = next ?? '/dashboard';
      let navRole: string | null | undefined;

      if (searchParams.get('via') === 'google') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const fresh = isFreshAccount(user.created_at);
          const chosen = searchParams.get('role');
          if (fresh) await applyReferral(user.id, searchParams.get('ref'));
          if (chosen === 'employer') await makeEmployerIfNew(user.id, user.created_at);
          if (chosen === 'spouse') await makeSpouseIfNew(user.id, user.created_at);
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
          const role = (profile?.role as Role | undefined) ?? null;
          navRole = role;
          await recordLogin(user.id, user.email);
          // A brand-new Google account that didn't pick a type yet (it came from the login page): ask once.
          dest = fresh && !chosen && role === 'veteran'
            ? `/account-setup?choose=1${next ? `&next=${encodeURIComponent(next)}` : ''}`
            : next ?? roleHome(role);
        }
      }

      const res = NextResponse.redirect(`${origin}${dest}`);
      const now = String(Date.now());
      res.cookies.set(LAST_SEEN_COOKIE, now, sessionCookieOptions);
      res.cookies.set(SESSION_START_COOKIE, now, sessionCookieOptions);
      if (navRole) res.cookies.set(NAV_COOKIE, navRoleFor(navRole), navCookieOptions);
      return res;
    }
  }

  const failedGoogle = searchParams.get('via') === 'google' || searchParams.get('error');
  return NextResponse.redirect(`${origin}/login?error=${failedGoogle ? 'google' : 'link'}`);
}
