import { CONVERSION_FEES_ENABLED, FREELANCE_PAYMENTS_ENABLED } from '@/lib/flags';
import { FREELANCE_FEES } from '@/lib/fees';
import type { Metadata } from 'next';
import Link from 'next/link';
import Invoices from '../Invoices';
import { notFound } from 'next/navigation';
import { requireFreelanceAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { startConversation } from '@/app/messages/actions';
import { CONTACT_BLOCKED, EXPLICIT_BLOCKED } from '@/lib/contact';
import { addMilestone, approveMilestone, cancelBooking, markContractComplete, cancelMilestone, declineContract, payBooking, requestConversion, leaveReview, openDispute, requestChanges, submitMilestone } from '../actions';

export const metadata: Metadata = { title: 'Contract' };
const usd = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const LABEL: Record<string, [string, string]> = {
  pending: [FREELANCE_PAYMENTS_ENABLED ? 'Awaiting funding' : 'Agreed amount', 'text-muted'], funded: ['Funded — protected', 'text-olive'], submitted: ['Submitted for review', 'text-navy'],
  released: ['Paid', 'text-olive'], refunded: ['Refunded', 'text-muted'], disputed: ['In dispute — under review', 'text-signal'], cancelled: ['Cancelled', 'text-muted'],
};
const ERR: Record<string, string> = { explicit: EXPLICIT_BLOCKED, invoice: 'Add what the invoice is for and an amount of at least $1.', invoice_payments: 'Remote work is paid through LanceNest milestones instead of invoices.', booking: 'We couldn’t open checkout for the booking fee. Please try again in a minute, or reach us through the Help page.', contact: CONTACT_BLOCKED, delivery: 'Describe what you delivered and where to find it (a link or file name).', changes: 'Say what doesn’t match the agreed scope, so the freelancer knows exactly what to fix.', salary: 'Enter the first-year base salary.', payouts: 'The freelancer’s payout account isn’t ready yet — we’ve let them know.', transfer: 'Payment couldn’t be released just now. Please try again in a few minutes.',
  state: 'That milestone has already changed — refresh to see the latest.', milestone: 'Milestones need a title and at least $25.', dispute: 'Please describe the problem (at least 10 characters).', review: 'Choose a rating from 1 to 5.' };

type M = { id: string; title: string; amount_cents: number; status: string; client_fee_cents: number; submission_note: string | null; change_request: string | null; dispute_reason: string | null; auto_release_at: string | null; released_at: string | null };

export default async function ContractPage(
  props: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const { user, profile } = await requireFreelanceAccess(`/freelance/contracts/${params.id}`);
  const supabase = await createClient();
  const { data: c } = await supabase.from('contracts')
    .select('id, title, status, veteran_fee_rate, client_id, freelancer_id, project_id, request_note, booking_status, booking_fee_cents, booking_paid_at, on_site, client:profiles!contracts_client_id_fkey(full_name), freelancer:profiles!contracts_freelancer_id_fkey(full_name, username)')
    .eq('id', params.id).maybeSingle();
  if (!c) notFound();
  const contract = c as unknown as { booking_status: string; booking_fee_cents: number | null; booking_paid_at: string | null; on_site: boolean; request_note?: string | null; id: string; title: string; status: string; veteran_fee_rate: number; client_id: string; freelancer_id: string; project_id: string | null; client: { full_name: string } | null; freelancer: { full_name: string; username: string | null } | null };
  const isClient = user.id === contract.client_id;
  const isFreelancer = user.id === contract.freelancer_id;
  const [{ data: mRows }, { data: myReview }] = await Promise.all([
    supabase.from('milestones').select('id, title, amount_cents, status, client_fee_cents, submission_note, change_request, dispute_reason, auto_release_at, released_at').eq('contract_id', contract.id).order('created_at'),
    supabase.from('reviews').select('id').eq('contract_id', contract.id).eq('reviewer_id', user.id).maybeSingle(),
  ]);
  const ms = (mRows ?? []) as M[];
  const keep = 1 - Number(contract.veteran_fee_rate);
  const other = isClient ? contract.freelancer_id : contract.client_id;
  // Not booked until the client pays the booking fee (lib/booking.ts). Milestones and contact details wait until then.
  const awaitingBooking = contract.booking_status === 'awaiting_payment' && contract.status === 'active';
  const live = contract.status === 'active' && !awaitingBooking;

  return (
    <div className="container-page max-w-4xl space-y-6 py-10">
      <Link href="/freelance" className="text-sm text-muted hover:text-navy">← Freelance</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl font-medium">{contract.title}</h1>
          <p className="mt-1 text-sm text-muted">Client: {contract.client?.full_name} · Freelancer: {contract.freelancer?.username ? <Link href={`/veterans/${contract.freelancer.username}`} className="text-navy underline">{contract.freelancer.full_name}</Link> : contract.freelancer?.full_name} · <span className="capitalize">{contract.status}</span></p>
        </div>
        <form action={startConversation.bind(null, other)}><SubmitButton className="btn btn-outline" pendingText="…">Message</SubmitButton></form>
      </div>
      {searchParams.error && <FormMessage error={ERR[searchParams.error] ?? 'Something went wrong — please try again.'} />}
      {searchParams.hired && <FormMessage message={FREELANCE_PAYMENTS_ENABLED ? 'Contract created. Fund the first milestone so work can begin — the payment is held until you approve.' : 'Booked. You can now share contact details in messages and arrange the work and payment directly with each other.'} />}
      {contract.status === 'cancelled' && <p className="rounded-xl border border-line bg-paper p-4 text-sm text-muted">This request was cancelled.</p>}
      {awaitingBooking && isClient && (
        <div className="card space-y-3 border-brass p-6">
          <p className="eyebrow">Confirm your booking</p>
          <p className="font-serif text-2xl text-navy">{contract.booking_fee_cents ? usd(contract.booking_fee_cents) : ''} booking fee</p>
          <p className="text-sm text-ink/85">Pay the booking fee to book {contract.freelancer?.full_name ?? 'this freelancer'}. They’re notified as soon as it’s paid, and you can then share contact details and set the schedule in messages. Refunded if they decline within 48 hours.</p>
          <div className="flex flex-wrap gap-2">
            <form action={payBooking.bind(null, contract.id)}><SubmitButton className="btn btn-primary" pendingText="Opening checkout…">Pay booking fee</SubmitButton></form>
            <form action={cancelBooking.bind(null, contract.id)}><SubmitButton className="btn btn-ghost border border-line" pendingText="…">Cancel request</SubmitButton></form>
          </div>
        </div>
      )}
      {awaitingBooking && isFreelancer && <p className="rounded-xl border border-line bg-paper p-4 text-sm">This request isn’t booked yet. You’ll be notified as soon as the client confirms it.</p>}
      {contract.booking_status === 'paid' && isClient && contract.booking_paid_at && <p className="text-xs text-muted">Booked {new Date(contract.booking_paid_at).toLocaleDateString('en-US', { dateStyle: 'medium' })} · booking fee {contract.booking_fee_cents ? usd(contract.booking_fee_cents) : ''} paid</p>}
      {searchParams.released && <FormMessage message="Payment released to the freelancer. Thank you!" />}
      {searchParams.completed && <FormMessage message="Marked complete. Leave a review below. It helps other members hire with confidence." />}
      {!FREELANCE_PAYMENTS_ENABLED && isClient && live && contract.booking_status === 'paid' && (
        <form action={markContractComplete.bind(null, contract.id)} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-olive/40 bg-olive/5 p-4 text-sm">
          <span>Job done? Mark it complete so you can both leave reviews, and it shows as verified work on their profile.</span>
          <SubmitButton className="btn btn-primary py-1.5 text-xs" pendingText="…">Mark job complete</SubmitButton>
        </form>
      )}
      {FREELANCE_PAYMENTS_ENABLED ? (
        <div className="rounded-xl border border-olive/30 bg-olive/5 p-4 text-sm text-ink/85">
          <strong className="text-olive">Protected Payments.</strong> <a href="/payments-protection" className="text-navy underline">How it works</a> · The client funds each milestone before work starts. LanceNest holds the money and releases it when the client approves — or automatically 14 days after the work is submitted. Either side can open a dispute and LanceNest will decide.
        </div>
      ) : (
        <div className="rounded-xl border border-brass/50 bg-brass/10 p-4 text-sm text-ink/85">
          <strong>Milestone payments on LanceNest are coming soon.</strong> Until then, use milestones to agree on scope and amounts, and arrange payment directly with each other. LanceNest isn’t a party to those payments and doesn’t hold or guarantee them.
        </div>
      )}

      {contract.request_note && <div className="card p-5 text-sm"><p className="eyebrow">Request details</p><p className="mt-2 whitespace-pre-line">{contract.request_note}</p></div>}
      {isFreelancer && live && ms.every((m) => ['pending', 'cancelled'].includes(m.status)) && (
        <form action={declineContract.bind(null, contract.id)} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper p-4 text-sm">
          <span>{contract.booking_status === 'paid' ? 'Not a fit? Decline within 48 hours, before you start talking details, and the client’s booking fee is refunded.' : 'Not a fit? You can decline before the client funds it — nothing is charged.'}</span>
          <SubmitButton className="btn btn-ghost border border-line py-1.5 text-xs" pendingText="…">Decline request</SubmitButton>
        </form>
      )}
      <section className="space-y-3">
        <h2 className="eyebrow">Milestones</h2>
        {ms.map((m) => {
          const [label, tone] = LABEL[m.status] ?? [m.status, 'text-muted'];
          return (
            <div key={m.id} className="card space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-medium">{m.title}</p><p className={`text-sm font-semibold ${tone}`}>{label}</p></div>
                <div className="text-right"><p className="font-serif text-2xl text-navy">{usd(m.amount_cents)}</p>
                  {isFreelancer && <p className="text-xs text-muted">You receive {usd(Math.round(m.amount_cents * keep))}</p>}</div>
              </div>
              {m.change_request && m.status === 'funded' && <p className="rounded-lg bg-brass/10 p-3 text-sm"><strong>Changes requested:</strong> {m.change_request}</p>}
              {m.submission_note && ['submitted', 'released', 'disputed'].includes(m.status) && <p className="rounded-lg bg-paper p-3 text-sm"><strong>Delivery note:</strong> {m.submission_note}</p>}
              {m.status === 'submitted' && m.auto_release_at && <p className="text-xs text-muted">Releases automatically on {new Date(m.auto_release_at).toLocaleDateString('en-US', { dateStyle: 'medium' })} unless the client acts.</p>}
              {m.status === 'disputed' && <p className="text-sm text-signal">Dispute: {m.dispute_reason}</p>}

              {isClient && m.status === 'pending' && live && (
                <div className="flex flex-wrap items-center gap-2">
                  {FREELANCE_PAYMENTS_ENABLED ? (
                    <>
                      <form action="/api/freelance/fund" method="post"><input type="hidden" name="milestone_id" value={m.id} /><input type="hidden" name="method" value="card" /><button className="btn btn-primary">Fund by card (5% fee)</button></form>
                      <form action="/api/freelance/fund" method="post"><input type="hidden" name="milestone_id" value={m.id} /><input type="hidden" name="method" value="bank" /><button className="btn btn-outline">Fund by bank transfer (3% fee)</button></form>
                    </>
                  ) : <span className="text-xs text-muted">Funding through LanceNest opens soon.</span>}
                  <form action={cancelMilestone.bind(null, m.id)}><button className="btn btn-ghost text-xs">Remove</button></form>
                </div>
              )}
              {isFreelancer && m.status === 'funded' && (
                <form action={submitMilestone.bind(null, m.id)} className="space-y-2">
                  <textarea name="note" rows={2} maxLength={2000} placeholder="What you delivered and where to find it (link or file name) — required" required minLength={10} className="field text-sm" />
                  <SubmitButton className="btn btn-primary" pendingText="Submitting…">Submit work for approval</SubmitButton>
                </form>
              )}
              {isClient && ['funded', 'submitted'].includes(m.status) && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <form action={approveMilestone.bind(null, m.id)}><SubmitButton className="btn btn-primary" pendingText="Releasing…">Approve & release {usd(m.amount_cents)}</SubmitButton></form>
                  {m.status === 'submitted' && (
                    <form action={requestChanges.bind(null, m.id)} className="flex flex-1 gap-2"><input name="changes" required minLength={10} placeholder="What doesn’t match the agreed scope?" className="field py-2 text-sm" /><SubmitButton className="btn btn-outline shrink-0" pendingText="…">Request changes</SubmitButton></form>
                  )}
                </div>
              )}
              {(isClient || isFreelancer) && ['funded', 'submitted'].includes(m.status) && (
                <details className="text-xs text-muted"><summary className="cursor-pointer hover:text-signal">Problem? Open a dispute</summary>
                  <form action={openDispute.bind(null, m.id)} className="mt-2 flex flex-col gap-2 sm:flex-row"><input name="reason" required minLength={10} placeholder="Describe what went wrong" className="field py-2 text-sm" /><SubmitButton className="btn btn-outline border-signal text-signal" pendingText="…">Open dispute</SubmitButton></form>
                </details>
              )}
            </div>
          );
        })}
        {isClient && live && (
          <form action={addMilestone.bind(null, contract.id)} className="card flex flex-col gap-2 p-5 sm:flex-row sm:items-end">
            <div className="flex-1"><label className="field-label" htmlFor="ms-title">Add a milestone</label><input id="ms-title" name="title" required placeholder="e.g. Phase 2 — reporting" className="field" /></div>
            <div className="sm:w-40"><label className="field-label" htmlFor="ms-amt">Amount ($)</label><input id="ms-amt" name="amount" required inputMode="decimal" className="field" /></div>
            <SubmitButton className="btn btn-outline shrink-0" pendingText="…">Add</SubmitButton>
          </form>
        )}
      </section>

      {(contract.booking_status === 'paid') && ['active', 'completed'].includes(contract.status) && (!FREELANCE_PAYMENTS_ENABLED || contract.on_site) && (isClient || isFreelancer) && (
        <>
          {searchParams.invoiced && <FormMessage message="Invoice sent. Your client was notified." />}
          <Invoices contractId={contract.id} isFreelancer={isFreelancer} isClient={isClient} />
        </>
      )}
      {(isClient || isFreelancer) && contract.status !== 'cancelled' && <p className="text-sm"><Link href={`/freelance/contracts/${contract.id}/agreement`} className="text-navy underline">Print the job agreement</Link></p>}
      {searchParams.converted && <FormMessage message="Thanks — we’ll confirm the conversion and send any invoice by email." />}
      {CONVERSION_FEES_ENABLED && isClient && profile.role === 'employer' && ['active', 'completed'].includes(contract.status) && (
        <details className="card p-5 text-sm"><summary className="cursor-pointer font-medium text-navy">Hire this freelancer full-time</summary>
          <p className="mt-2 text-muted">Converting a LanceNest contractor to a full-time employee within 12 months of your first contract carries a one-time fee of {Math.round(FREELANCE_FEES.conversionFee.firstYearPayRate * 100)}% of first-year base salary (minimum ${(FREELANCE_FEES.conversionFee.minimumCents / 100).toLocaleString()}). After 12 months, it’s free.</p>
          <form action={requestConversion.bind(null, contract.id)} className="mt-3 flex flex-col gap-2 sm:flex-row"><input name="salary" required inputMode="decimal" placeholder="First-year base salary ($)" className="field" /><SubmitButton className="btn btn-primary shrink-0" pendingText="…">Request conversion</SubmitButton></form>
        </details>
      )}
      {contract.status === 'completed' && (isClient || isFreelancer) && (
        myReview ? <p className="card p-5 text-sm text-olive">✓ Thanks — your review is posted.</p> : (
          <form action={leaveReview.bind(null, contract.id, other)} className="card space-y-3 p-6">
            <p className="eyebrow">Leave a review</p>
            <div className="flex gap-4 text-sm">{[5, 4, 3, 2, 1].map((n) => <label key={n} className="flex items-center gap-1"><input type="radio" name="rating" value={n} required className="accent-navy" />{'★'.repeat(n)}</label>)}</div>
            <textarea name="body" rows={3} maxLength={2000} placeholder={isClient ? 'How was working with this freelancer?' : 'How was working with this client?'} className="field text-sm" />
            <SubmitButton className="btn btn-primary" pendingText="Posting…">Post review</SubmitButton>
          </form>
        )
      )}
    </div>
  );
}
