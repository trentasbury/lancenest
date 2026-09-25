import { NextResponse, type NextRequest } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

/** Stripe's hosted billing page: update card, view invoices, cancel. */
export async function POST(request: NextRequest) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, '');
  const session = await getSessionProfile();
  if (!session) return NextResponse.redirect(`${site}/login`, 303);
  const { data: company } = await createClient().from('companies').select('stripe_customer_id').eq('owner_id', session.user.id).maybeSingle();
  if (!company?.stripe_customer_id) return NextResponse.redirect(`${site}/employer/dashboard`, 303);
  const portal = await stripe().billingPortal.sessions.create({ customer: company.stripe_customer_id as string, return_url: `${site}/employer/dashboard` });
  return NextResponse.redirect(portal.url, 303);
}
