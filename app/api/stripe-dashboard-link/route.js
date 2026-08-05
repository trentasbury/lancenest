import { NextResponse } from 'next/server';
import { stripe } from '../../../lib/stripe';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

// Generates a one-time login link into the freelancer's own Stripe Express dashboard,
// where they can see full payout history, bank details, and tax forms.

export async function POST(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_account_id, stripe_onboarded')
    .eq('id', user.id)
    .single();

  if (!profile?.stripe_account_id || !profile?.stripe_onboarded) {
    return NextResponse.json({ error: 'Connect Stripe first.' }, { status: 400 });
  }

  const loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id);

  return NextResponse.json({ url: loginLink.url });
}
