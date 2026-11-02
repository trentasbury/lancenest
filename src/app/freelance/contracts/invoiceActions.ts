'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFreelanceAccess } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE, notifyMember } from '@/lib/email';
import { FREELANCE_PAYMENTS_ENABLED } from '@/lib/flags';
import { invoiceFeeCheckoutUrl, invoiceFeeDue, usd } from '@/lib/booking';

const page = (id: string, q = '') => `/freelance/contracts/${id}${q}`;

async function bookedContract(contractId: string) {
  const { data } = await createAdminClient().from('contracts').select('id, title, client_id, freelancer_id, status, booking_status, on_site, booking_fee_payer').eq('id', contractId).maybeSingle();
  return data as { id: string; title: string; client_id: string; freelancer_id: string; status: string; booking_status: string; on_site: boolean; booking_fee_payer: string | null } | null;
}

/** The freelancer bills the client for a booked job (paid directly while LanceNest payments are off, or for on-site work). */
export async function createInvoice(contractId: string, formData: FormData) {
  const { user } = await requireFreelanceAccess(page(contractId));
  const k = await bookedContract(contractId);
  if (!k || k.freelancer_id !== user.id || !['active', 'completed'].includes(k.status) || k.booking_status !== 'paid') redirect(page(contractId));
  if (FREELANCE_PAYMENTS_ENABLED && !k.on_site) redirect(page(contractId, '?error=invoice_payments'));
  const amount = Math.round(Number(String(formData.get('amount') ?? '').replace(/[$,\s]/g, '')) * 100);
  const description = String(formData.get('description') ?? '').trim().slice(0, 2000);
  const due = String(formData.get('due_on') ?? '');
  const how = String(formData.get('pay_instructions') ?? '').trim().slice(0, 500) || null;
  if (!Number.isFinite(amount) || amount < 100 || description.length < 3 || (due && !/^\d{4}-\d{2}-\d{2}$/.test(due))) redirect(page(contractId, '?error=invoice#invoices'));
  const admin = createAdminClient();
  // One invoice waiting on a booking fee update at a time, so the update is never counted twice.
  const { count: waiting } = await admin.from('contract_invoices').select('id', { count: 'exact', head: true }).eq('contract_id', k.id).eq('held', true).neq('status', 'void');
  if (waiting) redirect(page(contractId, '?error=invoice_held#invoices'));
  // The booking fee follows what's actually invoiced: if this invoice takes the job past what the fee already covers,
  // the difference is paid first (by whoever pays this job's booking fee), then the invoice goes out.
  const feeDue = await invoiceFeeDue(k.id, amount);
  const year = new Date().getUTCFullYear();
  const { count } = await admin.from('contract_invoices').select('id', { count: 'exact', head: true }).eq('freelancer_id', user.id);
  const number = `LN-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`;
  const { data: inv, error } = await admin.from('contract_invoices').insert({ contract_id: k.id, freelancer_id: k.freelancer_id, client_id: k.client_id, number, description, amount_cents: amount, due_on: due || null, pay_instructions: how, held: feeDue > 0, fee_due_cents: feeDue }).select('id').single();
  if (error || !inv) { console.error('invoice failed:', error?.message); redirect(page(contractId, '?error=invoice#invoices')); }
  revalidatePath(page(contractId));
  if (!feeDue) {
    await notifyMember(k.client_id, { type: 'invoice', link: page(k.id, '#invoices'), title: `New invoice ${number} for “${k.title}”: ${usd(amount)}.` });
    redirect(page(contractId, '?invoiced=1#invoices'));
  }
  if (k.booking_fee_payer === 'freelancer') {
    // The freelancer covers this job's booking fee, so the update is theirs: straight to checkout.
    const url = await invoiceFeeCheckoutUrl(k.id, inv.id as string, user.id, user.email);
    redirect(url ?? page(contractId, '?error=invoice#invoices'));
  }
  await notifyMember(k.client_id, { type: 'invoice', link: page(k.id, '#invoices'),
    title: `Invoice ${number} for “${k.title}” (${usd(amount)}) is ready. It takes the job past what your booking fee covered: pay the ${usd(feeDue)} update to receive it.`,
    email: { subject: `Invoice ready: ${k.title}`, preheader: `A ${usd(feeDue)} booking fee update comes first.`, tone: 'notice', badge: 'Invoice',
      heading: 'Your freelancer sent an invoice.',
      paragraphs: [`Invoice ${number} for “${k.title}” is ${usd(amount)}. With it, this job is now more than your booking fee covered.`,
        `LanceNest’s booking fee is 5% of the job, at most $249 in all. Pay the ${usd(feeDue)} difference and the invoice opens right away.`],
      cta: { label: 'Open the invoice', url: `${SITE}${page(k.id, '#invoices')}` } } });
  redirect(page(contractId, '?invoiced=held#invoices'));
}

/** Pays the booking fee update on a held invoice (only whoever pays this job's booking fee). */
export async function payInvoiceFee(contractId: string, invoiceId: string) {
  const { user } = await requireFreelanceAccess(page(contractId));
  const url = await invoiceFeeCheckoutUrl(contractId, invoiceId, user.id, user.email);
  redirect(url ?? page(contractId, '#invoices'));
}

export async function setInvoiceStatus(contractId: string, invoiceId: string, status: 'paid' | 'void') {
  const { user } = await requireFreelanceAccess(page(contractId));
  const admin = createAdminClient();
  const { data: inv } = await admin.from('contract_invoices').select('id, number, client_id, freelancer_id, status, amount_cents, held').eq('id', invoiceId).eq('contract_id', contractId).maybeSingle();
  if (!inv || inv.status !== 'sent') redirect(page(contractId, '#invoices'));
  // A held invoice hasn't been sent yet: it can be cancelled, not marked paid.
  if (inv.held && status === 'paid') redirect(page(contractId, '#invoices'));
  const mine = inv.client_id === user.id || inv.freelancer_id === user.id;
  if (!mine || (status === 'void' && inv.freelancer_id !== user.id)) redirect(page(contractId, '#invoices'));
  await admin.from('contract_invoices').update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null }).eq('id', invoiceId);
  const other = user.id === inv.client_id ? inv.freelancer_id : inv.client_id;
  await notifyMember(other as string, { type: 'invoice', link: page(contractId, '#invoices'), title: status === 'paid' ? `Invoice ${inv.number} was marked paid.` : `Invoice ${inv.number} was cancelled.` });
  revalidatePath(page(contractId));
  redirect(page(contractId, '#invoices'));
}
