import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireFreelanceAccess } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import PrintButton from '@/components/PrintButton';

export const metadata: Metadata = { title: 'Invoice', robots: { index: false } };
const usd = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00Z` : d).toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'UTC' });

export default async function InvoicePage(props: { params: Promise<{ id: string; invoiceId: string }> }) {
  const { id, invoiceId } = await props.params;
  const { user } = await requireFreelanceAccess(`/freelance/contracts/${id}`);
  const admin = createAdminClient();
  const { data: inv } = await admin.from('contract_invoices').select('number, description, amount_cents, due_on, pay_instructions, status, created_at, paid_at, client_id, freelancer_id, contract:contracts(title), client:profiles!contract_invoices_client_id_fkey(full_name), freelancer:profiles!contract_invoices_freelancer_id_fkey(full_name)').eq('id', invoiceId).eq('contract_id', id).maybeSingle();
  const i = inv as unknown as { number: string; description: string; amount_cents: number; due_on: string | null; pay_instructions: string | null; status: string; created_at: string; paid_at: string | null; client_id: string; freelancer_id: string; contract: { title: string } | null; client: { full_name: string } | null; freelancer: { full_name: string } | null } | null;
  if (!i || (i.client_id !== user.id && i.freelancer_id !== user.id)) notFound();
  return (
    <div className="container-page max-w-3xl py-8">
      <div className="mb-4 flex justify-end print:hidden"><PrintButton label="Print or save as PDF" /></div>
      <article className="rounded-xl border border-line bg-white p-10 text-sm text-ink print:border-0 print:p-0">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div><p className="font-serif text-3xl font-semibold">Invoice</p><p className="mt-1 text-muted">{i.number}</p></div>
          <div className="text-right"><p><strong>Date:</strong> {day(i.created_at)}</p>{i.due_on && <p><strong>Due:</strong> {day(i.due_on)}</p>}<p className="mt-1 font-semibold uppercase tracking-[0.12em] text-xs">{i.status === 'paid' ? `Paid${i.paid_at ? ` ${day(i.paid_at)}` : ''}` : i.status === 'void' ? 'Cancelled' : 'Unpaid'}</p></div>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div><p className="eyebrow">From</p><p className="mt-1">{i.freelancer?.full_name}</p><p className="text-xs text-muted">Independent contractor, booked through LanceNest</p></div>
          <div><p className="eyebrow">Bill to</p><p className="mt-1">{i.client?.full_name}</p></div>
        </div>
        <table className="mt-8 w-full text-left">
          <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-muted"><tr><th className="py-2">Description</th><th className="py-2 text-right">Amount</th></tr></thead>
          <tbody><tr className="border-b border-line align-top"><td className="py-3 pr-6"><p className="font-medium">{i.contract?.title}</p><p className="mt-1 whitespace-pre-line text-ink/85">{i.description}</p></td><td className="py-3 text-right">{usd(i.amount_cents)}</td></tr></tbody>
          <tfoot><tr><td className="py-3 text-right font-semibold">Total</td><td className="py-3 text-right font-semibold">{usd(i.amount_cents)}</td></tr></tfoot>
        </table>
        {i.pay_instructions && <p className="mt-6"><strong>How to pay:</strong> {i.pay_instructions}</p>}
        <p className="mt-8 text-xs text-muted">Payment goes directly to the freelancer. LanceNest isn’t a party to this payment and doesn’t hold funds for it. The freelancer is responsible for their own taxes.</p>
      </article>
    </div>
  );
}
