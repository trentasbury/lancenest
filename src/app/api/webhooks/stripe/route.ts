import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { applyCheckoutSession, syncSubscription } from '@/lib/billing';
import { createAdminClient } from '@/lib/supabase/admin';

/** Stripe → LanceNest. Signature-verified; each event is processed once. */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');
  if (!secret || !signature) return NextResponse.json({ error: 'not configured' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: dup } = await admin.from('billing_events').insert({ id: event.id, type: event.type });
  if (dup) return NextResponse.json({ received: true, duplicate: true });

  try {
    if (event.type === 'checkout.session.completed') {
      await applyCheckoutSession((event.data.object as Stripe.Checkout.Session).id);
    } else if (event.type.startsWith('customer.subscription.')) {
      await syncSubscription(event.data.object as Stripe.Subscription);
    }
  } catch (err) {
    // Let Stripe retry: forget this event so the retry is processed.
    await admin.from('billing_events').delete().eq('id', event.id);
    console.error('stripe webhook failed:', err);
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
