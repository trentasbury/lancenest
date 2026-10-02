import { NextResponse, type NextRequest } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

/** Opens the freelancer's Stripe Express dashboard (payouts, bank details, instant payouts where eligible). */
export async function GET(request: NextRequest) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, '');
  const session = await getSessionProfile();
  if (!session) return NextResponse.redirect(`${site}/login?next=/freelance/earnings`);
  const { data: fp } = await createClient().from('freelancer_profiles').select('stripe_account_id').eq('profile_id', session.user.id).maybeSingle();
  if (!fp?.stripe_account_id) return NextResponse.redirect(`${site}/freelance/profile`);
  try {
    const link = await stripe().accounts.createLoginLink(fp.stripe_account_id as string);
    return NextResponse.redirect(link.url);
  } catch { return NextResponse.redirect(`${site}/freelance/earnings?error=stripe`); }
}
