import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import VerificationBadge from '@/components/VerificationBadge';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { submitVerification } from './actions';

export const metadata: Metadata = { title: 'Verify your service' };

const ERRORS: Record<string, string> = {
  missing: 'Choose a file to upload.',
  redact: 'Please confirm you’ve blacked out your Social Security number.',
  size: 'That file is over 4 MB. Try a PDF export or a smaller photo.',
  type: 'Upload a PDF, JPG, or PNG.',
  pending: 'You already have a document under review.',
  upload: 'The upload didn’t go through. Please try again.',
};

const ACCEPTED = [
  ['Veterans', 'DD-214 (Member-4 copy preferred) or VA Health / Veteran ID card.'],
  ['Active duty & transitioning', 'A recent LES (Leave and Earnings Statement) or your separation / retirement orders.'],
  ['Guard & Reserve', 'NGB-22, a recent LES, or current orders.'],
];

export default async function VerificationPage({ searchParams }: { searchParams: { error?: string; submitted?: string; required?: string } }) {
  const { user } = await requireRole(['veteran'], '/dashboard/verification');
  const supabase = createClient();
  const [{ data: vet }, { data: latest }] = await Promise.all([
    supabase.from('veteran_profiles').select('verification_status').eq('profile_id', user.id).maybeSingle(),
    supabase.from('verification_requests').select('status, created_at, reviewed_at, notes').eq('profile_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const status = vet?.verification_status ?? 'not_verified';
  const canSubmit = status === 'not_verified' || status === 'failed';

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page py-10">
          <Link href="/dashboard" className="text-sm text-cream/70 hover:text-brass">← Dashboard</Link>
          <h1 className="mt-3 font-serif text-4xl font-medium text-ivory">Verify your service</h1>
          <p className="mt-1 max-w-2xl text-cream/75">
            A verified badge tells employers a real person reviewed your proof of service. It’s free, and every profile is checked by hand.
          </p>
        </div>
      </section>

      <div className="container-page grid max-w-5xl gap-8 py-10 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {searchParams.required && status !== 'verified' && (
            <div className="card border-brass p-5">
              <p className="font-medium">LanceNest is for verified service members.</p>
              <p className="mt-1 text-sm text-muted">
                Jobs, the network, messaging, and member profiles unlock as soon as your service is verified. Until then you can build your profile so it’s ready.
              </p>
            </div>
          )}
          {searchParams.error && <FormMessage error={ERRORS[searchParams.error] ?? ERRORS.upload} />}
          {searchParams.submitted && <FormMessage message="Received. We’ll review it and update your badge — usually within 3 business days." />}

          <div className="card p-7">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif text-2xl font-semibold">Your status</h2>
              <VerificationBadge status={status} />
            </div>
            {status === 'verified' && <p className="mt-4 text-sm text-muted">You’re verified. Your document was deleted after review — we don’t keep it.</p>}
            {status === 'pending' && latest && (
              <p className="mt-4 text-sm text-muted">Submitted {new Date(latest.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}. A reviewer will check it by hand.</p>
            )}
            {status === 'failed' && (
              <p className="mt-4 text-sm text-signal">
                We couldn’t verify the last document{latest?.notes ? `: ${latest.notes}` : '.'} You can submit a new one below.
              </p>
            )}
          </div>

          {canSubmit && (
            <form action={submitVerification} className="card space-y-5 p-7">
              <h2 className="font-serif text-2xl font-semibold">Submit a document</h2>
              <div>
                <label htmlFor="doc_type" className="field-label">Document type</label>
                <select id="doc_type" name="doc_type" className="field" defaultValue="DD-214">
                  <option>DD-214</option>
                  <option>VA ID card</option>
                  <option>LES</option>
                  <option>Orders</option>
                  <option>NGB-22</option>
                </select>
              </div>
              <div>
                <label htmlFor="document" className="field-label">File (PDF, JPG, or PNG · up to 4 MB)</label>
                <input id="document" name="document" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required className="field file:mr-3 file:rounded-[3px] file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-sm file:text-ivory" />
              </div>
              <label className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" name="redacted" required className="mt-0.5 h-4 w-4 accent-navy" />
                <span>I’ve blacked out my Social Security number and any other information not needed to confirm my service.</span>
              </label>
              <SubmitButton className="btn btn-primary" pendingText="Uploading…">Submit for review</SubmitButton>
            </form>
          )}
        </div>

        <aside className="space-y-5">
          <div className="card p-6">
            <p className="eyebrow">What we accept</p>
            <ul className="mt-4 space-y-3 text-sm">
              {ACCEPTED.map(([who, what]) => (
                <li key={who}><span className="font-semibold text-ink">{who}:</span> <span className="text-ink/80">{what}</span></li>
              ))}
            </ul>
          </div>
          <div className="card border-signal/30 p-6">
            <p className="eyebrow text-signal">Never upload</p>
            <p className="mt-3 text-sm leading-relaxed text-ink/85">
              Your CAC or any military ID card. Photographing or copying a military ID is prohibited by federal law (18 U.S.C. § 701).
            </p>
          </div>
          <div className="card p-6">
            <p className="eyebrow">How your document is handled</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink/80">
              <li>Stored privately — only you and our reviewer can open it.</li>
              <li>Checked by a person, not an algorithm.</li>
              <li>Deleted as soon as the review is complete.</li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
