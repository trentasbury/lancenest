import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

export const metadata: Metadata = { title: 'Earnings' };
const usd = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function EarningsPage({ searchParams }: { searchParams: { error?: string } }) {
  const { user } = await requireRole(['veteran', 'admin'], '/freelance/earnings');
  const supabase = createClient();
  const [{ data: contracts }, { data: fp }] = await Promise.all([
    supabase.from('contracts').select('id, title, veteran_fee_rate, milestones(amount_cents, status, released_at)').eq('freelancer_id', user.id),
    supabase.from('freelancer_profiles').select('stripe_account_id, payouts_enabled').eq('profile_id', user.id).maybeSingle(),
  ]);
  let held = 0, released = 0, thisYear = 0;
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
  for (const c of (contracts ?? []) as unknown as { veteran_fee_rate: number; milestones: { amount_cents: number; status: string; released_at: string | null }[] }[]) {
    for (const m of c.milestones ?? []) {
      const net = Math.round(m.amount_cents * (1 - Number(c.veteran_fee_rate)));
      if (['funded', 'submitted', 'disputed'].includes(m.status)) held += net;
      if (m.status === 'released') { released += net; if (m.released_at && Date.parse(m.released_at) >= yearStart) thisYear += net; }
    }
  }
  // Live balance and recent payouts from Stripe (when payouts are set up).
  let available = 0, pending = 0; let payouts: { amount: number; arrival_date: number; status: string }[] = [];
  if (fp?.stripe_account_id) {
    try {
      const [bal, po] = await Promise.all([
        stripe().balance.retrieve({}, { stripeAccount: fp.stripe_account_id as string }),
        stripe().payouts.list({ limit: 5 }, { stripeAccount: fp.stripe_account_id as string }),
      ]);
      available = bal.available.filter((b) => b.currency === 'usd').reduce((a, b) => a + b.amount, 0);
      pending = bal.pending.filter((b) => b.currency === 'usd').reduce((a, b) => a + b.amount, 0);
      payouts = po.data.map((p) => ({ amount: p.amount, arrival_date: p.arrival_date, status: p.status }));
    } catch { /* Stripe not reachable yet — show LanceNest totals only */ }
  }
  const card = (label: string, value: string, hint: string) => <div className="card p-5"><p className="eyebrow">{label}</p><p className="mt-2 font-serif text-3xl text-navy">{value}</p><p className="mt-1 text-xs text-muted">{hint}</p></div>;
  return (
    <div className="container-page max-w-4xl space-y-6 py-10">
      <Link href="/freelance" className="text-sm text-muted hover:text-navy">← Freelance</Link>
      <h1 className="font-serif text-4xl font-medium">Earnings</h1>
      {searchParams.error && <p className="text-sm text-signal">Stripe couldn’t open your payout dashboard just now — please try again.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {card('Held for you', usd(held), 'Funded milestones, protected until approval')}
        {card('In your Stripe balance', usd(available + pending), pending ? `${usd(pending)} still settling` : 'Ready for your next payout')}
        {card('Paid this year', usd(thisYear), 'After LanceNest fees')}
        {card('All-time earnings', usd(released), 'After LanceNest fees')}
      </div>
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="eyebrow">Payouts</p><p className="mt-1 text-sm text-muted">Payouts go to your bank automatically. Eligible accounts can also choose instant payout to a debit card in Stripe (Stripe charges a small fee).</p></div>
          {fp?.payouts_enabled ? <a href="/api/connect/dashboard" className="btn btn-primary shrink-0">Open payout dashboard ↗</a> : <Link href="/freelance/profile" className="btn btn-primary shrink-0">Set up payouts</Link>}
        </div>
        {payouts.length > 0 && (
          <ul className="mt-4 divide-y divide-line text-sm">
            {payouts.map((p, i) => <li key={i} className="flex justify-between py-2"><span>{new Date(p.arrival_date * 1000).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span><span className="capitalize text-muted">{p.status.replace('_', ' ')}</span><span className="font-medium">{usd(p.amount)}</span></li>)}
          </ul>
        )}
      </section>
      <p className="text-xs text-muted">Freelance income is taxable. Stripe issues tax forms (such as Form 1099-K) when required. Keep records of your expenses.</p>
    </div>
  );
}
