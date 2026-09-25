import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { applyCheckoutSession } from '@/lib/billing';

export const metadata: Metadata = { title: 'Payment complete', robots: { index: false } };

export default async function BillingSuccess({ searchParams }: { searchParams: { session_id?: string } }) {
  await requireRole(['employer', 'veteran'], '/employer/dashboard');
  let result: Awaited<ReturnType<typeof applyCheckoutSession>> = { ok: false };
  try {
    if (searchParams.session_id?.startsWith('cs_')) result = await applyCheckoutSession(searchParams.session_id);
  } catch (err) {
    console.error('billing success check failed:', err);
  }
  const message =
    result.ok && result.kind === 'job_boost' ? 'Your job is now featured for 30 days.'
    : result.ok && result.kind === 'job_slot' ? 'Your extra job slot is active.'
    : result.ok ? 'Your plan is active. Thank you for supporting veteran hiring.'
    : 'We’re confirming your payment with Stripe. This usually takes a few seconds — refresh your dashboard shortly.';

  return (
    <div className="container-page flex max-w-lg flex-col py-20 text-center">
      <p className="eyebrow">{result.ok ? 'Payment complete' : 'Almost there'}</p>
      <h1 className="mt-3 font-serif text-4xl font-medium">{result.ok ? 'You’re all set.' : 'Processing…'}</h1>
      <p className="mt-4 text-muted">{message}</p>
      <Link href="/employer/dashboard" className="btn btn-primary mx-auto mt-8">Go to your dashboard</Link>
    </div>
  );
}
