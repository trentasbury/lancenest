import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireVerifiedMember } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import PrintButton from '@/components/PrintButton';

export const metadata: Metadata = { title: 'Job agreement', robots: { index: false } };
const day = (d: string) => new Date(d).toLocaleDateString('en-US', { dateStyle: 'long' });

/** A printable summary of what the two sides agreed to on LanceNest. */
export default async function AgreementPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { user } = await requireVerifiedMember(`/freelance/contracts/${id}`);
  const admin = createAdminClient();
  const { data } = await admin.from('contracts').select('title, status, created_at, booking_paid_at, on_site, request_note, client_id, freelancer_id, client:profiles!contracts_client_id_fkey(full_name), freelancer:profiles!contracts_freelancer_id_fkey(full_name), project:freelance_projects(description, work_location), proposal:proposals(bid_amount, timeline), service:service_listings(description, price_cents, price_type)').eq('id', id).maybeSingle();
  const k = data as unknown as { title: string; status: string; created_at: string; booking_paid_at: string | null; on_site: boolean; request_note: string | null; client_id: string; freelancer_id: string; client: { full_name: string } | null; freelancer: { full_name: string } | null; project: { description: string; work_location: string | null } | null; proposal: { bid_amount: number; timeline: string | null } | null; service: { description: string; price_cents: number; price_type: string } | null } | null;
  if (!k || (k.client_id !== user.id && k.freelancer_id !== user.id)) notFound();
  const price = k.proposal ? `$${k.proposal.bid_amount.toLocaleString('en-US')}` : k.service ? `$${(k.service.price_cents / 100).toLocaleString('en-US')}${k.service.price_type === 'hourly' ? ' per hour' : k.service.price_type === 'starting_at' ? ' (starting price)' : ''}` : 'As agreed in messages';
  const scope = k.project?.description ?? k.service?.description ?? '';
  return (
    <div className="container-page max-w-3xl py-8">
      <div className="mb-4 flex justify-end print:hidden"><PrintButton label="Print or save as PDF" /></div>
      <article className="space-y-5 rounded-xl border border-line bg-white p-10 text-sm leading-relaxed text-ink print:border-0 print:p-0">
        <div><p className="font-serif text-3xl font-semibold">Job agreement</p><p className="text-muted">Made on LanceNest · {day(k.created_at)}{k.booking_paid_at ? ` · booked ${day(k.booking_paid_at)}` : ''}</p></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><p className="eyebrow">Client</p><p>{k.client?.full_name}</p></div><div><p className="eyebrow">Freelancer (independent contractor)</p><p>{k.freelancer?.full_name}</p></div></div>
        <div><p className="eyebrow">Job</p><p className="font-medium">{k.title}</p>{k.project?.work_location && <p className="text-muted">Where: {k.project.work_location}</p>}<p className="mt-2 whitespace-pre-line text-ink/85">{scope}</p>{k.request_note && <p className="mt-2 whitespace-pre-line text-ink/85">Request: {k.request_note}</p>}</div>
        <div><p className="eyebrow">Price</p><p>{price}{k.proposal?.timeline ? ` · Timeline: ${k.proposal.timeline}` : ''}</p></div>
        <div><p className="eyebrow">What both sides agreed to on LanceNest</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-ink/85">
            <li>The freelancer is an independent contractor, not the client’s employee, and controls how the work is done.</li>
            <li>The freelancer holds any license, permit and insurance the work legally requires.</li>
            <li>Payment is arranged directly between the two sides unless it is made through LanceNest.</li>
            <li>For 24 months, further work between the two sides that started on LanceNest is booked on LanceNest (LanceNest Terms).</li>
            <li>No classified or controlled (CUI) information is shared through LanceNest.</li>
          </ul></div>
        <p className="text-xs text-muted">This is a summary of the booking on LanceNest, not legal advice. LanceNest’s Terms of Service apply. Status: {k.status}.</p>
      </article>
    </div>
  );
}
