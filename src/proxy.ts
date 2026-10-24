import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

/**
 * When the session check runs:
 *  - Members-only areas: always (signed-out visitors are sent to log in).
 *  - Everything else: only for visitors carrying a session or LanceNest session cookies.
 *    Signed-out visitors get pre-built pages straight from the location nearest them, with
 *    nothing in between. (Matchers must be literal values, so the pattern is repeated.)
 * Keep the members-only list in sync with PROTECTED_PREFIXES in lib/supabase/middleware.ts.
 * The Supabase cookie name includes the project ref (ugjdzruswfzdiskvetvy); update it if the project changes.
 */
export const config = {
  matcher: [
    '/dashboard/:path*', '/employer/:path*', '/admin/:path*', '/applications/:path*', '/saved-jobs/:path*',
    '/messages/:path*', '/onboarding/:path*', '/settings/:path*', '/network/:path*', '/notifications/:path*',
    '/security/mfa/:path*', '/jobs/:path*', '/billing/:path*', '/freelance/:path*', '/transition/:path*',
    '/people/:path*', '/training/:path*', '/groups/:path*', '/mentors/:path*', '/fairs/:path*',
    { source: '/((?!_next/static|_next/image|favicon.ico|icon.svg|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)', has: [{ type: 'cookie', key: 'sb-ugjdzruswfzdiskvetvy-auth-token' }] },
    { source: '/((?!_next/static|_next/image|favicon.ico|icon.svg|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)', has: [{ type: 'cookie', key: 'sb-ugjdzruswfzdiskvetvy-auth-token.0' }] },
    { source: '/((?!_next/static|_next/image|favicon.ico|icon.svg|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)', has: [{ type: 'cookie', key: 'ln_nav' }] },
    { source: '/((?!_next/static|_next/image|favicon.ico|icon.svg|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)', has: [{ type: 'cookie', key: 'ln_last_seen' }] },
    { source: '/((?!_next/static|_next/image|favicon.ico|icon.svg|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)', has: [{ type: 'cookie', key: 'ln_session_start' }] },
  ],
};
