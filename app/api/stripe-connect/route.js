import { NextResponse } from 'next/server';
import { stripe } from '../../../lib/stripe';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_account_id, email')
    .eq('id', user.id)
    .single();

  let accountId = profile?.stripe_account_id;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: profile.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    accountId = account.id;
    await supabaseAdmin.from('profiles').update({ stripe_account_id: accountId }).eq('id', user.id);
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/freelancer`,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/freelancer?onboarded=true`,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: accountLink.url });
}
