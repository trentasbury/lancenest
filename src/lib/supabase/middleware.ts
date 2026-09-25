import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { IDLE_LIMIT_MS, LAST_SEEN_COOKIE, MAX_SESSION_MS, SESSION_START_COOKIE, sessionCookieOptions } from '@/lib/session';

const PROTECTED_PREFIXES = ['/dashboard', '/employer', '/admin', '/applications', '/saved-jobs', '/messages', '/onboarding', '/settings', '/network', '/notifications'];

function isProtected(path: string) {
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Runs on every request: refreshes the auth session, enforces the inactivity and
 * maximum-session limits, and bounces signed-out visitors away from protected areas.
 * Role checks happen server-side in each protected layout (requireRole).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const now = Date.now();

  if (user) {
    const lastSeen = Number(request.cookies.get(LAST_SEEN_COOKIE)?.value) || 0;
    const startedAt = Number(request.cookies.get(SESSION_START_COOKIE)?.value) || 0;
    const idle = lastSeen > 0 && now - lastSeen > IDLE_LIMIT_MS;
    const expired = startedAt > 0 && now - startedAt > MAX_SESSION_MS;

    if (idle || expired) {
      // End this session on the server (other devices stay signed in), then clear every auth cookie.
      await supabase.auth.signOut({ scope: 'local' });
      const authCookies = request.cookies.getAll().filter((c) => c.name.startsWith('sb-')).map((c) => c.name);
      authCookies.forEach((name) => request.cookies.delete(name));
      request.cookies.delete(LAST_SEEN_COOKIE);
      request.cookies.delete(SESSION_START_COOKIE);

      let out: NextResponse;
      if (isProtected(path)) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.search = `?reason=${idle ? 'idle' : 'expired'}&next=${encodeURIComponent(path)}`;
        out = NextResponse.redirect(url);
      } else {
        out = NextResponse.next({ request });
      }
      [...authCookies, LAST_SEEN_COOKIE, SESSION_START_COOKIE].forEach((name) =>
        out.cookies.set(name, '', { path: '/', maxAge: 0 }),
      );
      return out;
    }

    // Any request counts as activity. The session start is stamped once, on the first request.
    response.cookies.set(LAST_SEEN_COOKIE, String(now), sessionCookieOptions);
    if (!startedAt) response.cookies.set(SESSION_START_COOKIE, String(now), sessionCookieOptions);
    return response;
  }

  // Signed out: drop any leftover timing cookies so a future login starts fresh.
  if (request.cookies.get(LAST_SEEN_COOKIE) || request.cookies.get(SESSION_START_COOKIE)) {
    response.cookies.set(LAST_SEEN_COOKIE, '', { path: '/', maxAge: 0 });
    response.cookies.set(SESSION_START_COOKIE, '', { path: '/', maxAge: 0 });
  }

  if (isProtected(path)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }

  return response;
}
