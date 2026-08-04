import { NextResponse } from 'next/server';
import { stripe, COMMISSION_PERCENT } from '../../../lib/stripe';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { freelancerId, title, amountDollars } = await req.json();

  if (!freelancerId || !title || !amountDollars || amountDollars <= 0) {
    return NextResponse.json({ error: 'Missing or invalid job details.' }, { status: 400 });
  }

  const { data: freelancer } = await supabaseAdmin
    .from('profiles')
    .select('stripe_account_id, stripe_onboarded, full_name')
    .eq('id', freelancerId)
    .single();

  if (!freelancer?.stripe_onboarded) {
    return NextResponse.json(
      { error: 'This freelancer has not finished payment setup yet.' },
      { status: 400 }
    );
  }

  const amountCents = Math.round(amountDollars * 100);
  const commissionCents = Math.round((amountCents * COMMISSION_PERCENT) / 100);

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .insert({
      client_id: user.id,
      freelancer_id: freelancerId,
      title,
      amount_cents: amountCents,
      commission_cents: commissionCents,
      status: 'pending',
    })
    .select()
    .single();

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }

  // Destination charge: client pays full amount, platform keeps commissionCents,
  // the rest flows automatically to the freelancer's connected Stripe account.
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: title, description: `Payment to ${freelancer.full_name} via Lancenest` },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: commissionCents,
      transfer_data: { destination: freelancer.stripe_account_id },
    },
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/jobs/${job.id}?paid=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/profile/${freelancerId}`,
    metadata: { job_id: job.id },
  });

  await supabaseAdmin
    .from('jobs')
    .update({ stripe_checkout_session_id: checkoutSession.id })
    .eq('id', job.id);

  return NextResponse.json({ url: checkoutSession.url });
}
