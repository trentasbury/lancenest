import { NextResponse, type NextRequest } from 'next/server';

/**
 * A partner's sign-up link (lancenest.com/partner/CODE): remembers the code for 30 days, then opens sign-up.
 * The member applies it with one click once their service is verified.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, '');
  const res = NextResponse.redirect(`${site}/signup?role=veteran`, 303);
  const clean = decodeURIComponent(code).trim().toUpperCase();
  if (/^[A-Z0-9-]{4,32}$/.test(clean)) {
    res.cookies.set('ln_partner', clean, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 30 * 86400 });
  }
  return res;
}
