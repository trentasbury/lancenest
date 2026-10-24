import type { Metadata } from 'next';
import Link from 'next/link';
import { requireVerifiedMember } from '@/lib/auth';
import { myCredentials } from '@/lib/credentials';
import { LICENSED_TRADES } from '@/lib/flags';
import { US_STATES } from '@/lib/states';
import FormMessage from '@/components/FormMessage';
import SubmitButton from '@/components/SubmitButton';
import CredentialForm from './CredentialForm';
import { removeCredential } from './actions';

export const metadata: Metadata = { title: 'Licenses & certificates', robots: { index: false } };

const ERRORS: Record<string, string> = {
  name: 'Enter the license or certificate name.', license: 'For a trade license, choose the trade and state and enter the license number.', date: 'Check the expiration date.',
  expired: 'That one has already expired.', file: 'The file didn’t upload. Please try again.', pending: 'You have 5 waiting for review already.', save: 'That didn’t save. Please try again.',
};
const STATUS: Record<string, string> = { pending: 'In review', verified: '✓ Verified', rejected: 'Not verified', expired: 'Expired' };

export default async function CredentialsPage(props: { searchParams: Promise<{ error?: string; submitted?: string }> }) {
  const { user } = await requireVerifiedMember('/dashboard/credentials');
  const sp = await props.searchParams;
  const creds = await myCredentials(user.id);
  return (
    <div className="container-page max-w-3xl py-10">
      <Link href="/dashboard" className="text-sm text-muted hover:text-navy">← Dashboard</Link>
      <h1 className="mt-3 font-serif text-4xl font-medium">Licenses & certificates</h1>
      <p className="mt-2 text-muted">Verified credentials show on your profile with a check mark. A verified trade license also lets you offer HVAC, electrical, plumbing, construction and roofing work in Freelance.</p>
      <div className="mt-6 space-y-6">
        {sp.error && <FormMessage error={ERRORS[sp.error] ?? ERRORS.save} />}
        {sp.submitted && <FormMessage message="Sent. Most reviews are done within 2 business days." />}
        {creds.length > 0 && (
          <ul className="card divide-y divide-line">
            {creds.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-medium text-ink">{c.name}</p>
                  <p className="text-xs text-muted">{[c.kind === 'license' ? `${c.trade} license` : 'Certificate', c.state, c.issuer, c.expires_on && `expires ${new Date(`${c.expires_on}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })}`].filter(Boolean).join(' · ')}</p>
                  {c.status === 'rejected' && c.note && <p className="mt-1 text-xs text-signal">{c.note}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.status === 'verified' ? 'bg-olive/10 text-olive' : c.status === 'pending' ? 'bg-brass/10 text-brass-dark' : 'bg-signal/10 text-signal'}`}>{STATUS[c.status] ?? c.status}</span>
                  <form action={removeCredential.bind(null, c.id)}><SubmitButton className="text-xs text-muted underline" pendingText="…">Remove</SubmitButton></form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <CredentialForm userId={user.id} trades={LICENSED_TRADES} states={US_STATES as unknown as [string, string][]} />
      </div>
    </div>
  );
}
