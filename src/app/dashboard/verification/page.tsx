import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import VerificationBadge from '@/components/VerificationBadge';
import FormMessage from '@/components/FormMessage';
import VerificationForm from './VerificationForm';
import { cookies } from 'next/headers';
import SubmitButton from '@/components/SubmitButton';
import { SPOUSE_INVITE_COOKIE, peekSpouseInvite } from '@/lib/spouse';
import { acceptInvite } from '../spouse/actions';

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

const INVITE_ERRORS: Record<string, string> = {
  invalid: 'That invite link has expired or was already used. Ask your service member for a new one, or verify with documents below.',
  not_spouse: 'Invite links are for military spouse accounts. Contact us through the Help page if you signed up as the wrong type.',
  self: 'You can’t accept your own invite.',
};

const ACCEPTED_SPOUSE = [
  ['Fastest', 'An invite link from your verified service member (they make it from their dashboard). No documents needed.'],
  ['Or one document', 'Orders listing you as a dependent, a DD Form 1172-2, your marriage certificate with your spouse’s DD-214 or LES, or a VA survivor benefits letter.'],
  ['Plus a photo ID', 'A driver’s license, state ID card, or U.S. passport (book or card). Never a military ID card.'],
];

const ACCEPTED = [
  ['Veterans', 'DD-214 (Member-4 copy preferred) or a VA benefit summary letter.'],
  ['Active duty & transitioning', 'A recent LES (Leave and Earnings Statement) or your separation / retirement orders.'],
  ['Guard & Reserve', 'NGB-22, a recent LES, or current orders.'],
  ['Plus a photo ID', 'A driver’s license, state ID card, or U.S. passport (book or card) with the same name.'],
];

export default async function VerificationPage(
  props: { searchParams: Promise<{ error?: string; submitted?: string; required?: string; invite_error?: string }> }
) {
  const searchParams = await props.searchParams;
  const { user } = await requireRole(['veteran'], '/dashboard/verification');
  const supabase = await createClient();
  const [{ data: vet }, { data: latest }] = await Promise.all([
    supabase.from('veteran_profiles').select('verification_status, member_type').eq('profile_id', user.id).maybeSingle(),
    supabase.from('verification_requests').select('status, created_at, reviewed_at, notes').eq('profile_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const status = vet?.verification_status ?? 'not_verified';
  const canSubmit = status === 'not_verified' || status === 'failed';
  const spouse = vet?.member_type === 'spouse';
  const invite = spouse && status !== 'verified' ? await peekSpouseInvite((await cookies()).get(SPOUSE_INVITE_COOKIE)?.value) : null;

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page py-10">
          <Link href="/dashboard" className="text-sm text-cream/70 hover:text-brass">← Dashboard</Link>
          <h1 className="mt-3 font-serif text-4xl font-medium text-ivory">{spouse ? 'Verify your military family connection' : 'Verify your service'}</h1>
          <p className="mt-1 max-w-2xl text-cream/75">
            {spouse ? 'A verified badge tells employers and members you’re a military spouse. It’s free: accept your service member’s invite, or send documents for a person to review.' : 'A verified badge tells employers a real person reviewed your proof of service. It’s free, and every profile is checked by hand.'}
          </p>
        </div>
      </section>

      <div className="container-page grid max-w-5xl gap-8 py-10 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {searchParams.required && status !== 'verified' && (
            <div className="card border-brass p-5">
              <p className="font-medium">{spouse ? "LanceNest is for verified service members and military spouses." : "LanceNest is for verified service members."}</p>
              <p className="mt-1 text-sm text-muted">
                Jobs, the network, messaging, and member profiles unlock as soon as your service is verified. Until then you can build your profile so it’s ready.
              </p>
            </div>
          )}
          {searchParams.error && <FormMessage error={ERRORS[searchParams.error] ?? ERRORS.upload} />}
          {searchParams.invite_error && <FormMessage error={INVITE_ERRORS[searchParams.invite_error] ?? INVITE_ERRORS.invalid} />}
          {invite && (
            <form action={acceptInvite} className="card border-olive/50 bg-olive/5 p-6">
              <p className="font-semibold text-ink">{invite.firstName} invited you to LanceNest as their spouse.</p>
              <p className="mt-1 text-sm text-muted">Accept to be verified right away. Only accept if {invite.firstName} is your spouse.</p>
              <SubmitButton className="btn btn-primary mt-4" pendingText="Verifying…">Accept and verify</SubmitButton>
            </form>
          )}
          {spouse && !invite && canSubmit && (
            <div className="card p-6 text-sm">
              <p className="font-semibold text-ink">Fastest: get an invite from your service member</p>
              <p className="mt-1 text-muted">If your spouse is a verified LanceNest member, they can send you a one-time link from their dashboard (Dashboard → Invite your spouse). Open it on this device and you’re verified, no documents needed.</p>
            </div>
          )}
          {searchParams.submitted && <FormMessage message="Received. We’ll review it and update your badge — usually within 48 hours." />}

          <div className="card p-7">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif text-2xl font-semibold">Your status</h2>
              <VerificationBadge status={status} />
            </div>
            {status === 'verified' && <p className="mt-4 text-sm text-muted">You’re verified. Both of your files were deleted as soon as the reviewer approved them — we don’t keep them.</p>}
            {status === 'pending' && latest && (
              <p className="mt-4 text-sm text-muted">Submitted {new Date(latest.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}. A reviewer will check your documents by hand.</p>
            )}
            {status === 'failed' && (
              <p className="mt-4 text-sm text-signal">
                We couldn’t verify your last submission{latest?.notes ? `: ${latest.notes}` : '.'} You can submit again below.
              </p>
            )}
          </div>

          {canSubmit && <VerificationForm userId={user.id} spouse={spouse} />}
        </div>

        <aside className="space-y-5">
          <div className="card p-6">
            <p className="eyebrow">What we accept</p>
            <ul className="mt-4 space-y-3 text-sm">
              {(spouse ? ACCEPTED_SPOUSE : ACCEPTED).map(([who, what]) => (
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
              <li>Opened only through 10-minute links, and every opening is logged.</li>
              <li>Both deleted as soon as the reviewer approves or rejects them, or automatically after 30 days if never reviewed.</li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
