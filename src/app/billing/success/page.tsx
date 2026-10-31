import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { applyCheckoutSession } from '@/lib/billing';

export const metadata: Metadata = { title: 'Payment complete', robots: { index: false } };

export default async function BillingSuccess(props: { searchParams: Promise<{ session_id?: string }> }) {
  const searchParams = await props.searchParams;
  const { profile } = await requireRole(['employer', 'veteran', 'client'], '/dashboard');
  let result: Awaited<ReturnType<typeof applyCheckoutSession>> = { ok: false };
  try {
    if (searchParams.session_id?.startsWith('cs_')) result = await applyCheckoutSession(searchParams.session_id);
  } catch (err) {
    console.error('billing success check failed:', err);
  }
  const message =
    result.ok && result.kind === 'job_boost' ? 'Your job is now featured for 30 days.'
    : result.ok && result.kind === 'job_slot' ? 'Your extra job slot is active.'
    : result.ok && result.kind === 'contact_pack' ? '10 extra new conversations were added. They’re used after your monthly allowance and don’t expire.'
    : result.ok && result.kind === 'proposal_pack' ? '5 extra proposals were added to your account. They never expire.'
    : result.ok && result.kind === 'shortlist' ? 'Your Search Sprint is booked. You’ll receive up to 5 screened introductions within 15 business days.'
    : result.ok && result.kind === 'fair_booth' ? 'Your career fair booth is booked. Add your pitch and video link from the fair page.'
    : result.ok && result.kind === 'training_webinar' ? 'Your sponsored info session is scheduled and promoted to members.'
    : result.ok && result.kind === 'booking' ? 'Your booking is confirmed. Your freelancer has been notified, and you can now share contact details and arrange the work in messages.'
    : result.ok && result.kind === 'milestone' ? 'The milestone is funded. The payment is protected and held until you approve the work.'
    : result.ok ? 'Your plan is active. Thank you for supporting veteran hiring.'
    : 'We’re confirming your payment with Stripe. This usually takes a few seconds — refresh your dashboard shortly.';

  return (
    <div className="container-page flex max-w-lg flex-col py-20 text-center">
      <p className="eyebrow">{result.ok ? 'Payment complete' : 'Almost there'}</p>
      <h1 className="mt-3 font-serif text-4xl font-medium">{result.ok ? 'You’re all set.' : 'Processing…'}</h1>
      <p className="mt-4 text-muted">{message}</p>
      {result.ok && result.kind === 'booking' && 'contractId' in result
        ? <Link href={`/freelance/contracts/${result.contractId}`} className="btn btn-primary mx-auto mt-8">Open the contract</Link>
        : result.ok && result.kind === 'proposal_pack'
        ? <Link href="/freelance" className="btn btn-primary mx-auto mt-8">Back to freelance projects</Link>
        : <Link href={profile.role === 'veteran' ? '/dashboard' : profile.role === 'client' ? '/freelance' : '/employer/dashboard'} className="btn btn-primary mx-auto mt-8">Go to your dashboard</Link>}
    </div>
  );
}
