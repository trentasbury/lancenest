import { NextResponse, type NextRequest } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

/** Stripe's hosted billing page: update card, view invoices, cancel. */
export async function POST(request: NextRequest) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, '');
  const session = await getSessionProfile();
  if (!session) return NextResponse.redirect(`${site}/login`, 303);
  let customer: string | null = null; let back = `${site}/employer/dashboard`;
  if (session.profile?.role === 'veteran') {
    const { data } = await createAdminClient().from('billing_customers').select('stripe_customer_id').eq('profile_id', session.user.id).maybeSingle();
    customer = (data?.stripe_customer_id as string) ?? null; back = `${site}/plans`;
  } else {
    const { data: company } = await createClient().from('companies').select('stripe_customer_id').eq('owner_id', session.user.id).maybeSingle();
    customer = (company?.stripe_customer_id as string) ?? null;
  }
  if (!customer) return NextResponse.redirect(back, 303);
  const portal = await stripe().billingPortal.sessions.create({ customer, return_url: back });
  return NextResponse.redirect(portal.url, 303);
}
