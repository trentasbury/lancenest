import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(req) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET_CONNECT);
    } catch (err2) {
      return NextResponse.json({ error: `Webhook signature invalid: ${err2.message}` }, { status: 400 });
    }
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    if (session.mode === 'payment' && session.metadata?.job_id) {
      await supabaseAdmin
        .from('jobs')
        .update({ status: 'paid', stripe_payment_intent_id: session.payment_intent })
        .eq('id', session.metadata.job_id);
    }

    if (session.mode === 'subscription' && session.metadata?.supabase_user_id) {
      await supabaseAdmin
        .from('profiles')
        .update({
          is_pro: true,
          pro_since: new Date().toISOString(),
          stripe_subscription_id: session.subscription,
        })
        .eq('id', session.metadata.supabase_user_id);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    await supabaseAdmin
      .from('profiles')
      .update({ is_pro: false })
      .eq('stripe_subscription_id', subscription.id);
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
