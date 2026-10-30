'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireFreelanceAccess } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyMember } from '@/lib/email';
import { FREELANCE_PAYMENTS_ENABLED } from '@/lib/flags';

const page = (id: string, q = '') => `/freelance/contracts/${id}${q}`;

async function bookedContract(contractId: string) {
  const { data } = await createAdminClient().from('contracts').select('id, title, client_id, freelancer_id, status, booking_status, on_site').eq('id', contractId).maybeSingle();
  return data as { id: string; title: string; client_id: string; freelancer_id: string; status: string; booking_status: string; on_site: boolean } | null;
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
  const year = new Date().getUTCFullYear();
  const { count } = await admin.from('contract_invoices').select('id', { count: 'exact', head: true }).eq('freelancer_id', user.id);
  const number = `LN-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`;
  const { error } = await admin.from('contract_invoices').insert({ contract_id: k.id, freelancer_id: k.freelancer_id, client_id: k.client_id, number, description, amount_cents: amount, due_on: due || null, pay_instructions: how });
  if (error) { console.error('invoice failed:', error.message); redirect(page(contractId, '?error=invoice#invoices')); }
  await notifyMember(k.client_id, { type: 'invoice', link: page(k.id, '#invoices'), title: `New invoice ${number} for “${k.title}”: $${(amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}.` });
  revalidatePath(page(contractId));
  redirect(page(contractId, '?invoiced=1#invoices'));
}

export async function setInvoiceStatus(contractId: string, invoiceId: string, status: 'paid' | 'void') {
  const { user } = await requireFreelanceAccess(page(contractId));
  const admin = createAdminClient();
  const { data: inv } = await admin.from('contract_invoices').select('id, number, client_id, freelancer_id, status, amount_cents').eq('id', invoiceId).eq('contract_id', contractId).maybeSingle();
  if (!inv || inv.status !== 'sent') redirect(page(contractId, '#invoices'));
  const mine = inv.client_id === user.id || inv.freelancer_id === user.id;
  if (!mine || (status === 'void' && inv.freelancer_id !== user.id)) redirect(page(contractId, '#invoices'));
  await admin.from('contract_invoices').update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null }).eq('id', invoiceId);
  const other = user.id === inv.client_id ? inv.freelancer_id : inv.client_id;
  await notifyMember(other as string, { type: 'invoice', link: page(contractId, '#invoices'), title: status === 'paid' ? `Invoice ${inv.number} was marked paid.` : `Invoice ${inv.number} was cancelled.` });
  revalidatePath(page(contractId));
  redirect(page(contractId, '#invoices'));
}
