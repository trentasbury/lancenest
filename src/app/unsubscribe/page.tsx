import type { Metadata } from 'next';
import Link from 'next/link';
import SubmitButton from '@/components/SubmitButton';
import { EMAIL_LISTS, verifyUnsubscribe } from '@/lib/emailLinks';
import { confirmUnsubscribe } from './actions';

export const metadata: Metadata = { title: 'Email preferences', robots: { index: false, follow: false } };

/**
 * Landing page for the unsubscribe link in mailing-list emails. Unsubscribing takes one button press
 * (not the page visit itself), so email security scanners that open links can't unsubscribe anyone.
 */
export default async function UnsubscribePage(
  props: { searchParams: Promise<{ u?: string; l?: string; t?: string; done?: string; invalid?: string }> }
) {
  const searchParams = await props.searchParams;
  const { u = '', l = '', t = '' } = searchParams;
  const valid = verifyUnsubscribe(u, l, t);
  const listName = valid ? EMAIL_LISTS[l as keyof typeof EMAIL_LISTS] : null;

  return (
    <div className="container-page max-w-xl py-16">
      <div className="card p-8 text-center">
        <h1 className="font-serif text-3xl font-medium text-navy">Email preferences</h1>
        {searchParams.done ? (
          <>
            <p className="mt-4 text-ink">You’re unsubscribed. We won’t send you weekly updates anymore.</p>
            <p className="mt-2 text-sm text-muted">You’ll still get emails about your account, security, and applications.</p>
          </>
        ) : valid ? (
          <form action={confirmUnsubscribe} className="mt-6 space-y-4">
            <input type="hidden" name="u" value={u} />
            <input type="hidden" name="l" value={l} />
            <input type="hidden" name="t" value={t} />
            <p className="text-ink">Stop receiving {listName} from LanceNest?</p>
            <SubmitButton className="btn btn-primary" pendingText="Saving…">Unsubscribe</SubmitButton>
          </form>
        ) : (
          <p className="mt-4 text-ink">That link isn’t valid or has been changed. Use the unsubscribe link in your latest email, or <a href="/help?kind=support&subject=Unsubscribe" className="text-navy underline">tell us through the Help page</a> and we’ll take care of it.</p>
        )}
        <Link href="/" className="mt-6 inline-block text-sm text-navy underline decoration-brass underline-offset-4">Go to LanceNest</Link>
      </div>
    </div>
  );
}
