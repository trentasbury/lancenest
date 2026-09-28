import { NextResponse, type NextRequest } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe';
import { feeBreakdown } from '@/lib/payments';

/** Client funds a milestone. LanceNest holds the payment until the client approves (or auto-release). */
export async function POST(request: NextRequest) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, '');
  const session = await getSessionProfile();
  if (!session || session.profile?.role !== 'employer') return NextResponse.redirect(`${site}/login?next=/freelance`, 303);
  const form = await request.formData();
  const milestoneId = String(form.get('milestone_id') ?? '');
  const method = form.get('method') === 'bank' ? 'bank' : 'card';
  const supabase = createClient();
  const { data: m } = await supabase.from('milestones').select('id, title, amount_cents, status, contract_id, contract:contracts(id, title, client_id, status)').eq('id', milestoneId).maybeSingle();
  const ms = m as unknown as { id: string; title: string; amount_cents: number; status: string; contract_id: string; contract: { id: string; title: string; client_id: string; status: string } } | null;
  if (!ms || ms.contract.client_id !== session.user.id || ms.status !== 'pending' || ms.contract.status !== 'active') return NextResponse.redirect(`${site}/freelance`, 303);

  const { data: all } = await supabase.from('milestones').select('amount_cents, status, funded_at').eq('contract_id', ms.contract_id);
  const firstPayment = !(all ?? []).some((x) => x.funded_at);
  const contractTotal = (all ?? []).filter((x) => x.status !== 'cancelled').reduce((a, x) => a + (x.amount_cents as number), 0);
  const fees = feeBreakdown(ms.amount_cents, method, firstPayment, contractTotal);

  const { data: company } = await supabase.from('companies').select('stripe_customer_id').eq('owner_id', session.user.id).maybeSingle();
  const lines = [
    { quantity: 1, price_data: { currency: 'usd', unit_amount: ms.amount_cents, product_data: { name: `${ms.contract.title} — ${ms.title}`, description: 'Protected Payment: held by LanceNest until you approve the work' } } },
    { quantity: 1, price_data: { currency: 'usd', unit_amount: fees.clientFee, product_data: { name: `LanceNest service fee (${method === 'bank' ? '3% bank transfer' : '5% card'})` } } },
    ...(fees.platformFee ? [{ quantity: 1, price_data: { currency: 'usd', unit_amount: fees.platformFee, product_data: { name: 'Contract start fee' + (fees.platformFee > 499 ? ' + small-project fee' : '') } } }] : []),
  ];
  const meta = { kind: 'milestone', milestone_id: ms.id, contract_id: ms.contract_id };
  const checkout = await stripe().checkout.sessions.create({
    mode: 'payment', line_items: lines, metadata: meta,
    payment_method_types: method === 'bank' ? ['us_bank_account'] : ['card'],
    ...(company?.stripe_customer_id ? { customer: company.stripe_customer_id as string } : { customer_email: session.user.email }),
    payment_intent_data: { transfer_group: ms.contract_id, metadata: meta },
    success_url: `${site}/billing/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${site}/freelance/contracts/${ms.contract_id}`,
  });
  await createAdminClient().from('milestones').update({ stripe_checkout_session_id: checkout.id, client_fee_cents: fees.clientFee, platform_fee_cents: fees.platformFee, payment_method: method }).eq('id', ms.id).eq('status', 'pending');
  return NextResponse.redirect(checkout.url!, 303);
}
