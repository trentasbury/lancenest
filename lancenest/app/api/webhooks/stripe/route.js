import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

// Register this endpoint's URL in Stripe Dashboard -> Developers -> Webhooks:
// https://yourdomain.com/api/webhooks/stripe
// Listen for: checkout.session.completed, account.updated

export async function POST(req) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature invalid: ${err.message}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const jobId = session.metadata?.job_id;
    if (jobId) {
      await supabaseAdmin
        .from('jobs')
        .update({ status: 'paid', stripe_payment_intent_id: session.payment_intent })
        .eq('id', jobId);
    }
  }

  if (event.type === 'account.updated') {
    const account = event.data.object;
    if (account.charges_enabled) {
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_onboarded: true })
        .eq('stripe_account_id', account.id);
    }
  }

  return NextResponse.json({ received: true });
}
