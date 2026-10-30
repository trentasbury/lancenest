import Link from 'next/link';
import SubmitButton from '@/components/SubmitButton';
import { idTypeLabel } from '@/app/dashboard/verification/idTypes';

export type Req = {
  id: string; profile_id: string; document_path: string | null; id_document_path: string | null; id_type: string | null;
  member_note: string | null; notes: string | null; created_at: string;
  profile: { full_name: string; username: string | null; avatar_url: string | null } | null;
  /** Filled in by the queue page: spouse or service member, and whether this is a spouse's yearly renewal. */
  member_type?: string | null; renewal?: boolean;
};

const FLAGS: Record<string, string> = {
  missing: 'Enter the legal first name, last name, and date of birth exactly as shown on the documents.',
  duplicate: '⚠ This person is already verified on another LanceNest account. Possible duplicate or ban evasion — check before approving.',
  discharge: 'Choose the discharge outcome before approving. Reject Bad Conduct and Dishonorable discharges.',
  oth: 'An Other Than Honorable approval needs a short reason (at least 10 characters).',
};

const CHECKS = [
  'Same full name on both documents. Middle names and initials can differ; read the member’s note for a name change.',
  'Same date of birth (DD-214 box 5). LES and orders may not show one — then match the name only.',
  'The photo ID is a driver’s license, state ID, or passport — never a military, VA, or other federal ID card — and isn’t expired.',
  'The ID photo looks like the profile photo, if they added one.',
  'Nothing looks edited: fonts, spacing, and the photo sit naturally on both documents.',
  'DD-214 box 24 (character of service): Honorable, General (Under Honorable Conditions) or Uncharacterized is fine. Other Than Honorable needs a closer look and a reason. Reject Bad Conduct and Dishonorable.',
  'Codes agree with each other: separation date (box 12b), character of service (box 24), and the separation and reentry codes (boxes 26 and 27). AI-made fakes often get these wrong.',
  'In doubt? Ask for a VA benefit summary letter (members download it from VA.gov, so it can’t be made up) or reject with “couldn’t confirm the document is genuine.”',
];

const isImage = (p: string | null) => !!p && /\.(jpg|png)$/i.test(p);

function DocPanel({ title, subtitle, path, url }: { title: string; subtitle: string; path: string | null; url: string | null }) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-line bg-paper">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="truncate text-xs text-muted">{subtitle}</p>
      </div>
      <div className="flex min-h-[220px] flex-1 items-center justify-center p-3">
        {!path ? (
          <p className="px-4 text-center text-sm text-signal">Not provided</p>
        ) : !url ? (
          <p className="px-4 text-center text-sm text-signal">File unavailable</p>
        ) : isImage(path) ? (
          <a href={url} target="_blank" rel="noopener noreferrer" title="Open full size">
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived private link, never cached or optimized */}
            <img src={url} alt={`${title} uploaded by the member`} className="max-h-[420px] w-auto max-w-full rounded-lg object-contain" referrerPolicy="no-referrer" />
          </a>
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-outline">Open PDF</a>
        )}
      </div>
      {url && isImage(path) && <p className="border-t border-line px-4 py-2 text-xs text-muted">Click the image to open it full size (link works for 10 minutes).</p>}
    </div>
  );
}

type Flag = { flag?: string; on?: string; why?: string };

/** One pending request: the two documents side by side, the reviewer checklist, and the decision forms. */
export default function VerificationCard({ r, docUrl, idUrl, flag, reject, approve }: {
  r: Req; docUrl: string | null; idUrl: string | null; flag: Flag | null;
  reject: (formData: FormData) => Promise<void>; approve: (formData: FormData) => Promise<void>;
}) {
  const flagText = !flag?.flag ? null
    : flag.flag === 'removed'
      ? `⚠ This person was removed from LanceNest on ${new Date(flag.on ?? '').toLocaleDateString()}${flag.why ? ` — ${flag.why}` : ''}. Reject unless an appeal was granted.`
      : FLAGS[flag.flag] ?? null;
  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {r.profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- small public avatar shown for the photo comparison
            <img src={r.profile.avatar_url} alt="Profile photo" className="h-14 w-14 rounded-full border border-line object-cover" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-paper text-[10px] text-muted">No photo</span>
          )}
          <div>
            <p className="font-serif text-xl font-semibold">{r.profile?.full_name ?? 'Member'}{r.renewal && <span className="ml-2 align-middle rounded-full border border-brass px-2 py-0.5 font-sans text-xs font-semibold text-brass-dark">Spouse yearly renewal</span>}</p>
            <p className="text-sm text-muted">
              Profile name · submitted {new Date(r.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
            {r.profile?.username && (
              <Link href={`/veterans/${r.profile.username}`} className="text-sm text-navy underline decoration-brass underline-offset-4">View profile</Link>
            )}
          </div>
        </div>
      </div>

      {r.member_note && (
        <p className="mt-4 rounded-xl border border-brass/40 bg-paper px-4 py-2.5 text-sm"><span className="font-semibold">Member’s note:</span> {r.member_note}</p>
      )}
      {!r.id_document_path && (
        <p className="mt-4 rounded-xl border border-signal/30 bg-signal/5 px-4 py-2.5 text-sm text-signal">
          Submitted before photo IDs were required. Reject with “Photo ID missing” to ask for one, or approve on the service document alone.
        </p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_280px]">
        <DocPanel title="Service document" subtitle={r.notes ?? 'Document'} path={r.document_path} url={docUrl} />
        <DocPanel title="Photo ID" subtitle={idTypeLabel(r.id_type)} path={r.id_document_path} url={idUrl} />
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Before you approve</p>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-ink/85">
            {CHECKS.map((c) => <li key={c}>{c}</li>)}
          </ol>
          <p className="mt-3 text-xs text-muted">Compare by eye only. Don’t download or save either file.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-line pt-5 lg:grid-cols-2 lg:items-end">
        <form action={reject} className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor={`note-${r.id}`} className="field-label">Reason (shown to member if rejected)</label>
            <input id={`note-${r.id}`} name="note" list="reject-reasons" maxLength={300} placeholder="Pick or type a reason" className="field" />
          </div>
          <SubmitButton className="btn btn-outline border-signal text-signal hover:bg-signal hover:text-ivory" pendingText="Saving…">Reject</SubmitButton>
        </form>
        <form action={approve} className="w-full space-y-2 rounded-xl border border-line bg-paper p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Identity check (from the documents)</p>
          {flagText && <p className="text-xs font-semibold text-signal">{flagText}</p>}
          <div className="grid gap-2 sm:grid-cols-3">
            <input name="first" required placeholder="Legal first name" aria-label="Legal first name" className="field py-2 text-sm" />
            <input name="last" required placeholder="Last name" aria-label="Last name" className="field py-2 text-sm" />
            <input name="dob" type="date" required aria-label="Date of birth" className="field py-2 text-sm" />
          </div>
          {r.member_type !== 'spouse' && !r.renewal && (
            <fieldset className="space-y-1.5 rounded-lg border border-line bg-ivory p-2.5 text-xs">
              <legend className="px-1 font-semibold text-ink">Discharge</legend>
              <label className="flex items-start gap-2"><input type="radio" name="discharge" value="eligible" required className="mt-0.5 accent-navy" />Still serving, or Honorable, General (Under Honorable Conditions) or Uncharacterized</label>
              <label className="flex items-start gap-2"><input type="radio" name="discharge" value="oth_approved" className="mt-0.5 accent-navy" />Other Than Honorable: I reviewed it and approve</label>
              <input name="oth_note" maxLength={300} placeholder="Reason, if Other Than Honorable (kept in the admin log only)" aria-label="Reason for approving an Other Than Honorable discharge" className="field py-1.5 text-xs" />
            </fieldset>
          )}
          {r.member_type === 'spouse' && (
            <label className="flex items-start gap-2 text-xs text-ink"><input type="checkbox" name="surviving" className="mt-0.5 accent-navy" />Surviving spouse (VA survivor benefits letter or a death certificate with the service record): status never expires</label>
          )}
          {r.member_type !== 'spouse' && (
            <label className="block text-xs text-ink">Separation, ETS or retirement date on the documents (optional; turns on free transition Pro if it’s within a year)
              <input name="sep_date" type="date" className="field mt-1 py-1.5 text-sm" />
            </label>
          )}
          {(flag?.flag === 'removed' || flag?.flag === 'duplicate') && (
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="override" className="accent-signal" />I’ve reviewed this flag and approve anyway</label>
          )}
          <p className="text-[11px] text-muted">Only a one-way fingerprint is saved — never the name or birth date.</p>
          <SubmitButton className="btn btn-primary w-full" pendingText="Checking…">Documents match — approve</SubmitButton>
        </form>
      </div>
    </div>
  );
}

/** Shared list of rejection reasons the reason field suggests (rendered once per page). */
export function RejectReasons() {
  return (
    <datalist id="reject-reasons">
      <option value="Photo ID missing — please upload a driver’s license, state ID, or passport with your service document" />
      <option value="The name on your photo ID doesn’t match your service document — add a note if your name changed" />
      <option value="The date of birth on your photo ID doesn’t match your service document" />
      <option value="That kind of ID can’t be accepted — use a driver’s license, state ID, or passport (never a military or VA ID card)" />
      <option value="Your photo ID is expired — please upload a current one" />
      <option value="Social Security number wasn’t blacked out — please redact it and resubmit" />
      <option value="A document is unreadable — please upload a clearer copy" />
      <option value="Not an accepted service document (DD-214, VA benefit summary letter, LES, orders, or NGB-22)" />
      <option value="Name on the documents doesn’t match your profile" />
      <option value="Your discharge type isn’t eligible. LanceNest accepts Honorable, General and Uncharacterized discharges. If yours was upgraded, send the updated DD-214 or DD-215." />
      <option value="We couldn’t confirm the document is genuine. Please upload a clear copy of the original, or a VA benefit summary letter from VA.gov." />
    </datalist>
  );
}
