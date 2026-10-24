import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/auth';
import { GOOGLE_SIGNIN } from '@/lib/oauth';

/** Starts "Continue with Google". The chosen account type, where to go next, and any referral ride along to the callback. */
export async function GET(request: NextRequest) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, '');
  if (!GOOGLE_SIGNIN) return NextResponse.redirect(`${site}/login`, 303);
  const p = request.nextUrl.searchParams;
  const role = ['employer', 'veteran', 'spouse'].includes(p.get('role') ?? '') ? (p.get('role') as string) : '';
  const next = safeNextPath(p.get('next'));
  const ref = (p.get('ref') ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);
  const back = new URLSearchParams({ via: 'google' });
  if (role) back.set('role', role);
  if (next) back.set('next', next);
  if (ref) back.set('ref', ref);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${site}/auth/callback?${back}`, queryParams: { prompt: 'select_account' } },
  });
  if (error || !data.url) return NextResponse.redirect(`${site}/login?error=google`, 303);
  return NextResponse.redirect(data.url, 303);
}
