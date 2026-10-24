import type { Metadata } from 'next';
import Link from 'next/link';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { subscribeNewsletter } from './actions';

export const metadata: Metadata = {
  title: 'Weekly jobs newsletter for veterans',
  description: 'New jobs from verified employers hiring veterans, pay insights and transition guides, every week. Free.',
};

export default async function NewsletterPage(props: { searchParams: Promise<{ sent?: string; already?: string; confirmed?: string; error?: string }> }) {
  const sp = await props.searchParams;
  return (
    <div className="container-page max-w-xl py-16">
      <p className="eyebrow">Weekly newsletter</p>
      <h1 className="mt-2 font-serif text-4xl font-medium">New jobs for veterans, every week.</h1>
      <p className="mt-3 text-muted">Jobs from verified employers, what they pay, and practical transition guides. One email a week, free, unsubscribe anytime.</p>
      <div className="mt-8 space-y-4">
        {sp.sent && <FormMessage message="Check your inbox: we sent a link to confirm your subscription." />}
        {sp.already && <FormMessage message="You’re already subscribed." />}
        {sp.confirmed && <FormMessage message="You’re subscribed. Your first issue arrives this week." />}
        {sp.error && <FormMessage error={sp.error === 'email' ? 'Enter a valid email address.' : sp.error === 'link' ? 'That confirmation link has expired. Sign up again below.' : 'Too many sign-ups right now. Please try again in a little while.'} />}
        <form action={subscribeNewsletter} className="card flex flex-col gap-3 p-6 sm:flex-row">
          <label htmlFor="nl-email" className="sr-only">Email</label>
          <input id="nl-email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" className="field flex-1" />
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          <input type="hidden" name="source" value="newsletter_page" />
          <SubmitButton className="btn btn-primary" pendingText="…">Subscribe</SubmitButton>
        </form>
        <p className="text-xs text-muted">We use your email only for this newsletter. See our <Link href="/privacy" className="underline">Privacy Policy</Link>. Already a member? You get a weekly digest automatically.</p>
      </div>
    </div>
  );
}
