import { NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getMyCompany } from '@/lib/employer';
import { NAV_COOKIE, navCookieOptions, navRoleFor } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * The signed-in member's menu details (name, photo, role, company page, unread notifications).
 * Pre-built pages show the right menu immediately from the menu hint, then fill in these
 * details from here. Only called by signed-in visitors; never cached.
 */
export async function GET() {
  const session = await getSessionProfile();
  const noStore = { 'Cache-Control': 'private, no-store' };
  if (!session) {
    const res = NextResponse.json({ signedIn: false }, { headers: noStore });
    res.cookies.set(NAV_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  }

  const p = session.profile;
  const [{ count }, company] = await Promise.all([
    createClient().from('notifications').select('id', { count: 'exact', head: true }).eq('profile_id', session.user.id).is('read_at', null),
    p?.role === 'employer' ? getMyCompany(session.user.id) : Promise.resolve(null),
  ]);

  const res = NextResponse.json(
    {
      signedIn: true,
      id: session.user.id,
      role: p?.role ?? null,
      fullName: p?.full_name ?? null,
      username: p?.username ?? null,
      avatarUrl: p?.avatar_url ?? null,
      companySlug: company?.slug ?? null,
      unread: count ?? 0,
    },
    { headers: noStore },
  );
  res.cookies.set(NAV_COOKIE, navRoleFor(p?.role), navCookieOptions);
  return res;
}
