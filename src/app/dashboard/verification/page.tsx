import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import VerificationBadge from '@/components/VerificationBadge';
import FormMessage from '@/components/FormMessage';
import VerificationForm from './VerificationForm';

export const metadata: Metadata = { title: 'Verify your service' };

const ERRORS: Record<string, string> = {
  missing: 'Choose your service document to upload.',
  id_missing: 'Add a photo of your driver’s license, state ID, or passport.',
  id_type: 'Choose which kind of photo ID you’re uploading.',
  redact: 'Please confirm you’ve blacked out your Social Security number and covered your ID number.',
  consent: 'Please agree to the photo ID check so a reviewer can confirm the documents are yours.',
  size: 'That file is over 4 MB. Try a PDF export or a smaller photo.',
  type: 'Upload a PDF, JPG, or PNG.',
  pending: 'You already have documents under review.',
  upload: 'The upload didn’t go through. Please try again.',
};

const ACCEPTED = [
  ['Veterans', 'DD-214 (Member-4 copy preferred) or a VA benefit summary letter.'],
  ['Active duty & transitioning', 'A recent LES (Leave and Earnings Statement) or your separation / retirement orders.'],
  ['Guard & Reserve', 'NGB-22, a recent LES, or current orders.'],
  ['Plus a photo ID', 'A driver’s license, state ID card, or U.S. passport (book or card) with the same name.'],
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
          {searchParams.submitted && <FormMessage message="Received. We’ll review it and update your badge — usually within 48 hours." />}

          <div className="card p-7">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif text-2xl font-semibold">Your status</h2>
              <VerificationBadge status={status} />
            </div>
            {status === 'verified' && <p className="mt-4 text-sm text-muted">You’re verified. Your documents were deleted after review — we don’t keep them.</p>}
            {status === 'pending' && latest && (
              <p className="mt-4 text-sm text-muted">Submitted {new Date(latest.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}. A reviewer will check your documents by hand.</p>
            )}
            {status === 'failed' && (
              <p className="mt-4 text-sm text-signal">
                We couldn’t verify your last submission{latest?.notes ? `: ${latest.notes}` : '.'} You can submit again below.
              </p>
            )}
          </div>

          {canSubmit && <VerificationForm userId={user.id} />}
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
              Your CAC, any military ID card, a VA ID card, or any other federal agency ID card. Photographing or copying them is prohibited by federal law (18 U.S.C. § 701).
              Also never upload security clearance records, DISS printouts, or anything classified or controlled (CUI) — LanceNest verifies service only.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink/85"><strong>Before you upload:</strong> cover your Social Security number, VA file number, and home address on the service document, and the ID number on your photo ID. We only need your name, date of birth, photo, branch, and dates of service.</p>
          </div>
          <div className="card p-6">
            <p className="eyebrow">How your documents are handled</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink/80">
              <li>Stored privately — only you and our reviewer can open them.</li>
              <li>Compared by a person, by eye. No face-matching software, and no biometric data is ever created or kept.</li>
              <li>Both deleted as soon as the review is complete, or automatically after 30 days if never reviewed.</li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
