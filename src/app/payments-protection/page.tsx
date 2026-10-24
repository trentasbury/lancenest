import type { Metadata } from 'next';
import Link from 'next/link';
import { FREELANCE_PAYMENTS_ENABLED } from '@/lib/flags';
import { bookingFeeTable } from '@/lib/feeMath';

export const metadata: Metadata = { alternates: { canonical: '/payments-protection' }, title: 'Protected Payments & disputes', description: 'How LanceNest holds, releases, and resolves freelance milestone payments.' };

export default function PaymentsProtectionPage() {
  const steps: [string, string][] = [
    ['Agree on the milestone', 'Each milestone has a title, an amount, and a description of the deliverable. Put the scope and acceptance criteria in writing in the contract messages before funding.'],
    ['The client funds it', 'The payment is held through Stripe Connect before work starts. LanceNest is not an escrow agent.'],
    ['The freelancer submits', 'Submitting requires a note saying what was delivered and where to find it — a link or file name.'],
    ['The client responds', 'Approve to release payment, or request changes by saying what doesn’t match the agreed scope.'],
    ['Reminder, then automatic release', 'If the client takes no action, a reminder is sent 3 days before the payment releases automatically, 14 days after submission.'],
    ['Disputes freeze the milestone', 'Either side can open a dispute before release. The payment stays held while LanceNest reviews it.'],
  ];
  return (
    <article className="container-page max-w-3xl space-y-8 py-14 text-[16px] leading-relaxed text-ink/90">
      <h1 className="font-serif text-4xl font-medium">Protected Payments & disputes</h1>
      {!FREELANCE_PAYMENTS_ENABLED && (
        <p className="rounded-xl border border-brass/50 bg-brass/10 p-4 text-sm"><strong>Coming soon.</strong> Milestone payments through LanceNest aren’t available yet. For now, clients and freelancers agree on payment directly, and LanceNest isn’t a party to those payments. This page describes how Protected Payments will work once they open.</p>
      )}
      <ol className="space-y-4">{steps.map(([h, b], i) => <li key={h} className="card p-5"><p className="font-semibold text-navy">{i + 1}. {h}</p><p className="mt-1 text-sm">{b}</p></li>)}</ol>
      <section><h2 className="font-serif text-2xl text-navy">How disputes are decided</h2>
        <ul className="mt-2 list-disc space-y-2 pl-6">
          <li>Both sides may submit evidence — messages, files, and the agreed scope — within 5 business days of the dispute opening.</li>
          <li>LanceNest reviews the contract record and releases the payment to the freelancer or refunds the client.</li>
          <li>Disputes over $2,500 receive a second review before a decision.</li>
          <li>Card-network chargebacks, payment-processor rules, and the law can override a platform decision.</li>
        </ul></section>
      <section><h2 className="font-serif text-2xl text-navy">Booking fee</h2>
        <p className="mt-2">When a client hires a freelancer, the client pays LanceNest a small booking fee based on the agreed price. Freelancers pay nothing to be booked. The fee is shown before payment and refunded if the freelancer declines within 48 hours, before the two of you start talking details. Contact details can be shared once the job is booked.</p>
        <table className="mt-4 w-full max-w-md text-sm"><thead><tr className="border-b border-line text-left"><th className="py-2 font-semibold">Job price</th><th className="py-2 text-right font-semibold">Booking fee</th></tr></thead>
          <tbody>{bookingFeeTable().map(([range, fee]) => <tr key={range} className="border-b border-line/60"><td className="py-2">{range}</td><td className="py-2 text-right tabular-nums">{fee}</td></tr>)}</tbody></table>
        <p className="mt-3 text-sm text-muted">{FREELANCE_PAYMENTS_ENABLED ? 'On-site jobs pay the booking fee; remote jobs paid through Protected Payments pay the payment fees below instead. When an on-site job also uses Protected Payments, the booking fee replaces the $9.99 contract-start fee.' : 'This applies to every hire while milestone payments are coming soon.'}</p></section>
      <section><h2 className="font-serif text-2xl text-navy">Payment fees{FREELANCE_PAYMENTS_ENABLED ? '' : ' (once milestone payments open)'}</h2>
        <p className="mt-2">Clients pay 5% by card or 3% by bank transfer, plus $9.99 per contract, shown before payment. Freelancers pay 10% on Free, 7% on Pro, or 5% on Career Accelerator, so they keep at least 90%. Each milestone is at least $25. On a refund, the milestone amount is returned in full; the client service fee (the percentage and the $9.99 contract fee) is not, because it covers payment processing.</p></section>
      <p className="text-sm text-muted">Full terms: <Link href="/terms" className="text-navy underline">Terms of Service</Link> · <Link href="/trust" className="text-navy underline">Trust & verification</Link></p>
    </article>
  );
}
