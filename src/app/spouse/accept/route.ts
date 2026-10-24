import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SPOUSE_INVITE_COOKIE } from '@/lib/spouse';

/**
 * The link a service member sends their spouse. Keeps the invite in a private cookie for 14 days, then sends the spouse
 * to create their account (or, if they're signed in, to the page where they accept it).
 */
export async function GET(request: NextRequest) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, '');
  const token = request.nextUrl.searchParams.get('t') ?? '';
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return NextResponse.redirect(`${site}/signup?role=spouse`, 303);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const res = NextResponse.redirect(`${site}${user ? '/dashboard/verification?invite=1' : '/signup?role=spouse&invite=1'}`, 303);
  res.cookies.set(SPOUSE_INVITE_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 14 * 86400 });
  return res;
}
