import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe';
import StatCard from '@/components/StatCard';

export const metadata: Metadata = { title: 'Insights', robots: { index: false } };
export const dynamic = 'force-dynamic';

const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
type Traffic = {
  views_today: number; views_7d: number; views_30d: number; visitors_today: number; avg_daily_visitors_7d: number;
  active_24h: number; active_7d: number; active_30d: number; signups_7d: number;
  members: { veterans: number; verified: number; employers: number };
  top_pages: { path: string; views: number }[]; top_referrers: { host: string; views: number }[]; daily: { day: string; views: number; visitors: number }[];
};

async function stripeMoney() {
  try {
    const s = stripe();
    const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
    const [balance, payouts, subs] = await Promise.all([
      s.balance.retrieve(),
      s.payouts.list({ limit: 4 }),
      s.subscriptions.list({ status: 'active', limit: 100 }),
    ]);
    let gross = 0, fees = 0, refunds = 0;
    for await (const tx of s.balanceTransactions.list({ created: { gte: monthStart }, limit: 100 })) {
      if (tx.type === 'charge' || tx.type === 'payment') { gross += tx.amount; fees += tx.fee; }
      else if (tx.type === 'refund' || tx.type === 'payment_refund') refunds += Math.abs(tx.amount);
      else if (tx.type === 'stripe_fee' || tx.type === 'application_fee') fees += Math.abs(tx.amount);
    }
    // Monthly recurring revenue, normalized (annual ÷ 12), with first-year Founding discounts applied.
    let mrr = 0;
    for (const sub of subs.data) {
      const item = sub.items.data[0];
      const amt = (item?.price.unit_amount ?? 0) * (item?.quantity ?? 1);
      let monthly = item?.price.recurring?.interval === 'year' ? amt / 12 : amt;
      const firstYear = Date.now() / 1000 - sub.created < 365 * 86400;
      if (sub.metadata?.founding === 'true' && firstYear) monthly -= item?.price.recurring?.interval === 'year' ? 50000 / 12 : 5000;
      mrr += monthly;
    }
    const sum = (arr: { amount: number; currency: string }[]) => arr.filter((b) => b.currency === 'usd').reduce((a, b) => a + b.amount, 0);
    return { ok: true as const, live: balance.livemode, available: sum(balance.available), pending: sum(balance.pending), gross, fees, refunds, mrr, activeSubs: subs.data.length, payouts: payouts.data };
  } catch (err) {
    console.error('insights stripe error:', err);
    return { ok: false as const };
  }
}

export default async function InsightsPage() {
  await requireAdmin('/admin/insights');
  const admin = createAdminClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [{ data: traffic }, money, { data: subsRows }, { data: purchases }] = await Promise.all([
    admin.rpc('admin_traffic_stats'),
    stripeMoney(),
    admin.from('subscriptions').select('plan, kind, status').in('status', ['active', 'trialing', 'past_due']),
    admin.from('purchases').select('kind, amount_cents').gte('created_at', monthStart),
  ]);
  const t = (traffic ?? {}) as Traffic;
  const planCount = (plan: string) => (subsRows ?? []).filter((r) => r.plan === plan).length;
  const boostsPaid = (purchases ?? []).filter((p) => p.kind === 'job_boost' && (p.amount_cents as number) > 0);
  const boostsIncluded = (purchases ?? []).filter((p) => p.kind === 'job_boost' && (p.amount_cents as number) === 0).length;
  const packs = (purchases ?? []).filter((p) => p.kind === 'contact_credits');
  const maxViews = Math.max(1, ...(t.daily ?? []).map((d) => d.views));

  return (
    <>
      <section className="bg-navy-deep text-ivory"><div className="container-page py-10">
        <Link href="/admin" className="text-sm text-cream/70 hover:text-brass">← Admin</Link>
        <h1 className="mt-3 font-serif text-4xl font-medium text-ivory">Insights</h1>
        <p className="mt-1 text-cream/75">Money, members, and traffic at a glance.</p>
      </div></section>

      <div className="container-page space-y-10 py-10">
        <section>
          <div className="flex items-center gap-3"><h2 className="eyebrow">Money</h2>
            {money.ok && !money.live && <span className="rounded-full bg-brass/15 px-3 py-0.5 text-xs font-semibold text-brass-dark">Stripe TEST mode — not real money</span>}</div>
          {money.ok ? (
            <>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Monthly recurring revenue" value={usd(money.mrr)} hint={`${money.activeSubs} active subscription${money.activeSubs === 1 ? '' : 's'}`} />
                <StatCard label="Collected this month" value={usd(money.gross)} hint={`Stripe fees ${usd(money.fees)}${money.refunds ? ` · refunds ${usd(money.refunds)}` : ''}`} />
                <StatCard label="In Stripe — available" value={usd(money.available)} hint="Ready to pay out to your bank" />
                <StatCard label="In Stripe — pending" value={usd(money.pending)} hint="Clearing (usually ~2 business days)" />
              </div>
              <div className="card mt-4 p-5">
                <p className="text-sm font-medium">Recent payouts to your bank</p>
                {money.payouts.length === 0 ? <p className="mt-1 text-sm text-muted">No payouts yet.</p> : (
                  <ul className="mt-2 divide-y divide-line text-sm">{money.payouts.map((p) => (
                    <li key={p.id} className="flex justify-between py-2"><span>{new Date(p.arrival_date * 1000).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span><span className="capitalize text-muted">{p.status.replace('_', ' ')}</span><span className="font-medium">{usd(p.amount)}</span></li>
                  ))}</ul>
                )}
              </div>
            </>
          ) : <p className="card mt-3 p-5 text-sm text-muted">Stripe isn’t connected yet — finish Phase 5 of your launch checklist and money will show here.</p>}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Professional" value={planCount('professional')} hint="active subscribers" />
            <StatCard label="Federal" value={planCount('federal')} hint="active subscribers" />
            <StatCard label="Extra job slots" value={planCount('job_slot')} hint="active add-ons" />
            <StatCard label="This month’s add-ons" value={usd([...boostsPaid, ...packs].reduce((a, p) => a + (p.amount_cents as number), 0))} hint={`${boostsPaid.length} boosts · ${packs.length} contact packs · ${boostsIncluded} included boosts used`} />
          </div>
        </section>

        <section>
          <h2 className="eyebrow">Members</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active today" value={t.active_24h ?? 0} hint={`${t.active_7d ?? 0} this week · ${t.active_30d ?? 0} this month`} />
            <StatCard label="Service members" value={t.members?.veterans ?? 0} hint={`${t.members?.verified ?? 0} verified`} />
            <StatCard label="Employers" value={t.members?.employers ?? 0} />
            <StatCard label="New signups (7 days)" value={t.signups_7d ?? 0} hint="Demo accounts excluded" />
          </div>
        </section>

        <section>
          <h2 className="eyebrow">Website traffic</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Visitors today" value={t.visitors_today ?? 0} hint={`~${t.avg_daily_visitors_7d ?? 0} per day this week`} />
            <StatCard label="Page views today" value={t.views_today ?? 0} />
            <StatCard label="Page views (7 days)" value={t.views_7d ?? 0} />
            <StatCard label="Page views (30 days)" value={t.views_30d ?? 0} />
          </div>
          <div className="card mt-4 p-5">
            <p className="text-sm font-medium">Last 14 days</p>
            {(t.daily ?? []).length === 0 ? <p className="mt-2 text-sm text-muted">Traffic appears here as soon as people visit.</p> : (
              <div className="mt-4 flex h-40 items-end gap-1.5">
                {(t.daily ?? []).map((d) => (
                  <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.views} views, ${d.visitors} visitors`}>
                    <div className="w-full rounded-t-[2px] bg-navy" style={{ height: `${Math.max(4, (d.views / maxViews) * 130)}px` }} />
                    <span className="text-[10px] text-muted">{d.day.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="card p-5"><p className="text-sm font-medium">Top pages (7 days)</p>
              <ul className="mt-2 space-y-1 text-sm">{(t.top_pages ?? []).map((p) => <li key={p.path} className="flex justify-between"><span className="truncate text-navy">{p.path}</span><span className="text-muted">{p.views}</span></li>)}</ul></div>
            <div className="card p-5"><p className="text-sm font-medium">Where visitors come from (30 days)</p>
              {(t.top_referrers ?? []).length === 0 ? <p className="mt-2 text-sm text-muted">Mostly direct visits so far.</p> :
              <ul className="mt-2 space-y-1 text-sm">{(t.top_referrers ?? []).map((r) => <li key={r.host} className="flex justify-between"><span>{r.host}</span><span className="text-muted">{r.views}</span></li>)}</ul>}</div>
          </div>
          <p className="mt-3 text-xs text-muted">Private analytics: no cookies, no cross-site tracking. Visitors are counted with an anonymous code that resets daily.</p>
        </section>
        {await (async () => {
          const { createAdminClient: adminDb } = await import('@/lib/supabase/admin');
          const db = adminDb();
          const since = new Date(Date.now() - 30 * 86400000).toISOString();
          const c = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
          const [members, verified, withProfile, applied, employers, verifiedCo, paying] = await Promise.all([
            c(db.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'veteran')),
            c(db.from('veteran_profiles').select('profile_id', { count: 'exact', head: true }).eq('verification_status', 'verified')),
            c(db.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'veteran').not('headline', 'is', null)),
            c(db.from('applications').select('id', { count: 'exact', head: true }).eq('source', 'lancenest')),
            c(db.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'employer')),
            c(db.from('companies').select('id', { count: 'exact', head: true }).eq('is_verified', true)),
            c(db.from('companies').select('id', { count: 'exact', head: true }).neq('plan', 'free')),
          ]);
          const { data: clicks } = await db.from('page_views').select('event').not('event', 'is', null).gte('created_at', since).limit(20000);
          const tally = new Map<string, number>(); (clicks ?? []).forEach((r) => tally.set(r.event as string, (tally.get(r.event as string) ?? 0) + 1));
          const row = (label: string, n: number, of?: number) => <li className="flex justify-between py-2"><span>{label}</span><span className="font-medium">{n.toLocaleString()}{of ? <span className="ml-2 text-xs text-muted">{Math.round((n / of) * 100)}%</span> : null}</span></li>;
          return (
            <section className="grid gap-6 lg:grid-cols-2">
              <div className="card p-6"><p className="eyebrow">Funnel (all time)</p>
                <ul className="mt-3 divide-y divide-line text-sm">
                  {row('Service members signed up', members)}{row('Verified', verified, members)}{row('Profile started (headline)', withProfile, members)}{row('Applications sent', applied)}
                  {row('Employers signed up', employers)}{row('Companies verified', verifiedCo, employers)}{row('Companies paying', paying, verifiedCo || undefined)}
                </ul></div>
              <div className="card p-6"><p className="eyebrow">Button clicks (last 30 days)</p>
                {tally.size === 0 ? <p className="mt-3 text-sm text-muted">No tracked clicks yet.</p> : <ul className="mt-3 divide-y divide-line text-sm">{Array.from(tally.entries()).sort((a, b) => b[1] - a[1]).map(([k, n]) => <li key={k} className="flex justify-between py-2"><span>{k.replace(/^cta_/, '').replace(/_/g, ' ')}</span><span className="font-medium">{n}</span></li>)}</ul>}
              </div>
            </section>
          );
        })()}
      </div>
    </>
  );
}
