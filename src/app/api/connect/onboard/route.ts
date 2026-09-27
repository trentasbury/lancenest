import { NextResponse, type NextRequest } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe';

/** Starts (or resumes) Stripe payout setup for a verified veteran freelancer. Stripe collects their identity, tax, and bank details — LanceNest never sees them. */
export async function POST(request: NextRequest) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, '');
  const session = await getSessionProfile();
  if (!session || session.profile?.role !== 'veteran') return NextResponse.redirect(`${site}/login?next=/freelance/profile`, 303);
  const { data: fp } = await createClient().from('freelancer_profiles').select('stripe_account_id').eq('profile_id', session.user.id).maybeSingle();
  if (!fp) return NextResponse.redirect(`${site}/freelance/profile?error=profile_first`, 303);

  let accountId = fp.stripe_account_id as string | null;
  if (!accountId) {
    const account = await stripe().accounts.create({
      type: 'express', country: 'US', email: session.user.email, business_type: 'individual',
      capabilities: { transfers: { requested: true } }, metadata: { profile_id: session.user.id },
    });
    accountId = account.id;
    await createAdminClient().from('freelancer_profiles').update({ stripe_account_id: accountId }).eq('profile_id', session.user.id);
  }
  const link = await stripe().accountLinks.create({
    account: accountId, type: 'account_onboarding',
    refresh_url: `${site}/freelance/profile?payouts=retry`, return_url: `${site}/freelance/profile?payouts=done`,
  });
  return NextResponse.redirect(link.url, 303);
}
