import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/auth';
import { LAST_SEEN_COOKIE, SESSION_START_COOKIE, sessionCookieOptions } from '@/lib/session';

/** Handles email-confirmation and password-reset links (PKCE code exchange). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next')) ?? '/dashboard';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const res = NextResponse.redirect(`${origin}${next}`);
      const now = String(Date.now());
      res.cookies.set(LAST_SEEN_COOKIE, now, sessionCookieOptions);
      res.cookies.set(SESSION_START_COOKIE, now, sessionCookieOptions);
      return res;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
