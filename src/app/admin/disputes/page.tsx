import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import SubmitButton from '@/components/SubmitButton';
import EmptyState from '@/components/EmptyState';
import { resolveDispute } from '../actions';

export const metadata: Metadata = { title: 'Payment disputes', robots: { index: false } };

export default async function DisputesPage({ searchParams }: { searchParams: { done?: string } }) {
  await requireAdmin('/admin/disputes');
  const { data } = await createAdminClient().from('milestones')
    .select('id, title, amount_cents, dispute_reason, submission_note, updated_at, contract:contracts(id, title, client:profiles!contracts_client_id_fkey(full_name), freelancer:profiles!contracts_freelancer_id_fkey(full_name))')
    .eq('status', 'disputed').order('updated_at');
  const rows = (data ?? []) as unknown as { id: string; title: string; amount_cents: number; dispute_reason: string | null; submission_note: string | null; contract: { id: string; title: string; client: { full_name: string } | null; freelancer: { full_name: string } | null } }[];
  return (
    <>
      <section className="bg-navy-deep text-ivory"><div className="container-page py-10">
        <Link href="/admin" className="text-sm text-cream/70 hover:text-brass">← Admin</Link>
        <h1 className="mt-3 font-serif text-4xl font-medium text-ivory">Payment disputes</h1>
        <p className="mt-1 text-cream/75">Read the contract and messages, then release the payment to the freelancer or refund the client. Decisions are final and logged.</p>
      </div></section>
      <div className="container-page max-w-4xl space-y-4 py-10">
        {searchParams.done && <p className={`text-sm ${searchParams.done === 'failed' ? 'text-signal' : 'text-olive'}`}>{searchParams.done === 'failed' ? 'That didn’t go through (for example, the freelancer’s payout account isn’t ready). Nothing was paid or refunded.' : `Done — ${searchParams.done === 'release' ? 'payment released to the freelancer' : 'client refunded'}.`}</p>}
        {rows.length === 0 && <EmptyState title="No open disputes." body="When a client or freelancer opens one, it appears here and you’re notified." />}
        {rows.map((m) => (
          <div key={m.id} className="card space-y-3 p-6">
            <div className="flex flex-wrap justify-between gap-3">
              <div><p className="font-serif text-2xl">{m.contract.title} — {m.title}</p><p className="text-sm text-muted">Client: {m.contract.client?.full_name} · Freelancer: {m.contract.freelancer?.full_name}</p></div>
              <p className="font-serif text-2xl text-navy">${(m.amount_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <p className="rounded-[3px] bg-signal/5 p-3 text-sm"><strong>Dispute:</strong> {m.dispute_reason}</p>
            {m.submission_note && <p className="rounded-[3px] bg-paper p-3 text-sm"><strong>Freelancer’s delivery note:</strong> {m.submission_note}</p>}
            <Link href={`/freelance/contracts/${m.contract.id}`} className="text-sm text-navy underline">Open the contract</Link>
            <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row">
              <form action={resolveDispute.bind(null, m.id, 'release')} className="flex flex-1 gap-2"><input name="note" placeholder="Decision note (logged)" className="field py-2 text-sm" /><SubmitButton className="btn btn-primary shrink-0" pendingText="…">Pay freelancer</SubmitButton></form>
              <form action={resolveDispute.bind(null, m.id, 'refund')} className="flex flex-1 gap-2"><input name="note" placeholder="Decision note (logged)" className="field py-2 text-sm" /><SubmitButton className="btn btn-outline shrink-0" pendingText="…">Refund client</SubmitButton></form>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
