import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import SubmitButton from '@/components/SubmitButton';
import { createInvoice, setInvoiceStatus } from './invoiceActions';

const usd = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
type Inv = { id: string; number: string; description: string; amount_cents: number; due_on: string | null; status: string; created_at: string };

/** Invoices on a booked job: the freelancer sends them, either side marks them paid. */
export default async function Invoices({ contractId, isFreelancer, isClient }: { contractId: string; isFreelancer: boolean; isClient: boolean }) {
  const { data } = await createAdminClient().from('contract_invoices').select('id, number, description, amount_cents, due_on, status, created_at').eq('contract_id', contractId).order('created_at', { ascending: false });
  const invoices = (data ?? []) as Inv[];
  return (
    <section id="invoices" className="card scroll-mt-24 space-y-4 p-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold">Invoices</h2>
        <p className="mt-1 text-sm text-muted">{isFreelancer ? 'Bill your client for this job. They pay you directly, the way you agreed.' : 'Invoices from your freelancer. Pay them directly, the way you agreed, then mark them paid.'}</p>
      </div>
      {invoices.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {invoices.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <Link href={`/freelance/contracts/${contractId}/invoices/${i.id}`} className="font-medium text-navy hover:underline">{i.number}</Link>
                <span className="text-muted"> · {usd(i.amount_cents)}{i.due_on ? ` · due ${new Date(`${i.due_on}T00:00:00Z`).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' })}` : ''}</span>
                <p className="text-xs text-muted">{i.description.slice(0, 120)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${i.status === 'paid' ? 'bg-olive/10 text-olive' : i.status === 'void' ? 'bg-line text-muted' : 'bg-brass/10 text-brass-dark'}`}>{i.status === 'sent' ? 'Unpaid' : i.status === 'paid' ? 'Paid' : 'Cancelled'}</span>
                {i.status === 'sent' && (isClient || isFreelancer) && <form action={setInvoiceStatus.bind(null, contractId, i.id, 'paid')}><SubmitButton className="btn btn-outline py-1 text-xs" pendingText="…">Mark paid</SubmitButton></form>}
                {i.status === 'sent' && isFreelancer && <form action={setInvoiceStatus.bind(null, contractId, i.id, 'void')}><SubmitButton className="text-xs text-muted underline" pendingText="…">Cancel</SubmitButton></form>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {isFreelancer && (
        <details className="rounded-xl border border-line p-4 text-sm">
          <summary className="cursor-pointer font-medium text-navy">New invoice</summary>
          <form action={createInvoice.bind(null, contractId)} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="field-label" htmlFor="inv-desc">What it’s for</label><textarea id="inv-desc" name="description" required rows={3} maxLength={2000} className="field" placeholder="e.g. AC repair: replaced capacitor and contactor, 2 hours labor" /></div>
            <div><label className="field-label" htmlFor="inv-amt">Amount ($)</label><input id="inv-amt" name="amount" required inputMode="decimal" className="field" /></div>
            <div><label className="field-label" htmlFor="inv-due">Due date <span className="font-normal text-muted">(optional)</span></label><input id="inv-due" name="due_on" type="date" className="field" /></div>
            <div className="sm:col-span-2"><label className="field-label" htmlFor="inv-how">How to pay you <span className="font-normal text-muted">(optional)</span></label><input id="inv-how" name="pay_instructions" maxLength={500} className="field" placeholder="e.g. Check, or the payment app we agreed on" /></div>
            <SubmitButton className="btn btn-primary sm:col-span-2" pendingText="Sending…">Send invoice</SubmitButton>
          </form>
        </details>
      )}
    </section>
  );
}
