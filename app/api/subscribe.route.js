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
    .select('email, stripe_customer_id, is_pro')
    .eq('id', user.id)
    .single();

  if (profile?.is_pro) {
    return NextResponse.json({ error: 'Already a Pro member.' }, { status: 400 });
  }

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await supabaseAdmin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        price: process.env.STRIPE_PRO_PRICE_ID,
        quantity: 1,
      },
    ],
    metadata: { supabase_user_id: user.id },
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/freelancer?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/upgrade`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
