import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Protected Payments & disputes', description: 'How LanceNest holds, releases, and resolves freelance milestone payments.' };

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
      <ol className="space-y-4">{steps.map(([h, b], i) => <li key={h} className="card p-5"><p className="font-semibold text-navy">{i + 1}. {h}</p><p className="mt-1 text-sm">{b}</p></li>)}</ol>
      <section><h2 className="font-serif text-2xl text-navy">How disputes are decided</h2>
        <ul className="mt-2 list-disc space-y-2 pl-6">
          <li>Both sides may submit evidence — messages, files, and the agreed scope — within 5 business days of the dispute opening.</li>
          <li>LanceNest reviews the contract record and releases the payment to the freelancer or refunds the client.</li>
          <li>Disputes over $2,500 receive a second review before a decision.</li>
          <li>Card-network chargebacks, payment-processor rules, and the law can override a platform decision.</li>
        </ul></section>
      <section><h2 className="font-serif text-2xl text-navy">Fees</h2>
        <p className="mt-2">Clients pay 5% by card or 3% by bank transfer, plus $9.99 per contract, shown before payment. Freelancers pay 15% on Free, 10% on Pro, or 8% on Pro Plus. On a refund, the client’s percentage fee is returned; the $9.99 contract fee is not.</p></section>
      <p className="text-sm text-muted">Full terms: <Link href="/terms" className="text-navy underline">Terms of Service</Link> · <Link href="/trust" className="text-navy underline">Trust & verification</Link></p>
    </article>
  );
}
