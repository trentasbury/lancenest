import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import SubmitButton from '@/components/SubmitButton';
import EmptyState from '@/components/EmptyState';
import { decideVerification } from '../actions';

export const metadata: Metadata = { title: 'Verification queue', robots: { index: false } };

type Req = { id: string; profile_id: string; document_path: string | null; notes: string | null; created_at: string; profile: { full_name: string; username: string | null } | null };

const FLAGS: Record<string, string> = {
  missing: 'Enter the legal first name, last name, and date of birth exactly as shown on the document.',
  duplicate: '⚠ This person is already verified on another LanceNest account. Possible duplicate or ban evasion — check before approving.',
};

export default async function VerificationQueue({ searchParams }: { searchParams: { req?: string; flag?: string; on?: string; why?: string } }) {
  await requireAdmin('/admin/verifications');
  const admin = createAdminClient();
  const { data } = await admin
    .from('verification_requests')
    .select('id, profile_id, document_path, notes, created_at, profile:profiles!verification_requests_profile_id_fkey(full_name, username)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  const requests = (data ?? []) as unknown as Req[];

  // Short-lived links so documents are never publicly reachable.
  const links = await Promise.all(
    requests.map(async (r) =>
      r.document_path ? (await admin.storage.from('verification-docs').createSignedUrl(r.document_path, 600)).data?.signedUrl ?? null : null,
    ),
  );

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page py-10">
          <Link href="/admin" className="text-sm text-cream/70 hover:text-brass">← Admin</Link>
          <h1 className="mt-3 font-serif text-4xl font-medium text-ivory">Verification queue</h1>
          <p className="mt-1 text-cream/75">Oldest first. Documents are deleted automatically when you approve or reject.</p>
        </div>
      </section>
      <div className="container-page max-w-4xl space-y-5 py-10">
        {requests.length === 0 && <EmptyState title="Nothing waiting for review." body="New submissions will appear here." />}
        {requests.map((r, i) => (
          <div key={r.id} className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-serif text-xl font-semibold">{r.profile?.full_name ?? 'Member'}</p>
                <p className="text-sm text-muted">
                  {r.notes ?? 'Document'} · submitted {new Date(r.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
                {r.profile?.username && (
                  <Link href={`/veterans/${r.profile.username}`} className="text-sm text-navy underline decoration-brass underline-offset-4">View profile</Link>
                )}
              </div>
              {links[i] ? (
                <a href={links[i]!} target="_blank" rel="noopener noreferrer" className="btn btn-outline">Open document (10 min link)</a>
              ) : (
                <span className="text-sm text-signal">Document unavailable</span>
              )}
            </div>
            <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-end">
              <form action={decideVerification.bind(null, r.id, 'failed')} className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label htmlFor={`note-${r.id}`} className="field-label">Reason (shown to member if rejected)</label>
                  <input id={`note-${r.id}`} name="note" list="reject-reasons" maxLength={300} placeholder="Pick or type a reason" className="field" />
                  <datalist id="reject-reasons">
                    <option value="Social Security number wasn’t blacked out — please redact it and resubmit" />
                    <option value="Name on the document doesn’t match your profile" />
                    <option value="Document is unreadable — please upload a clearer copy" />
                    <option value="Not an accepted document type (DD-214, VA benefit summary letter, LES, orders, or NGB-22)" />
                    <option value="Military ID cards can’t be accepted (18 U.S.C. § 701)" />
                  </datalist>
                </div>
                <SubmitButton className="btn btn-outline border-signal text-signal hover:bg-signal hover:text-ivory" pendingText="Saving…">Reject</SubmitButton>
              </form>
              <form action={decideVerification.bind(null, r.id, 'verified')} className="w-full space-y-2 rounded-[4px] border border-line bg-paper p-3 sm:w-auto">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Identity check (from the document)</p>
                {searchParams.req === r.id && searchParams.flag && (
                  <p className="text-xs font-semibold text-signal">
                    {searchParams.flag === 'removed'
                      ? `⚠ This person was removed from LanceNest on ${new Date(searchParams.on ?? '').toLocaleDateString()}${searchParams.why ? ` — ${searchParams.why}` : ''}. Reject unless an appeal was granted.`
                      : FLAGS[searchParams.flag]}
                  </p>
                )}
                <div className="grid gap-2 sm:grid-cols-3">
                  <input name="first" required placeholder="Legal first name" className="field py-2 text-sm" />
                  <input name="last" required placeholder="Last name" className="field py-2 text-sm" />
                  <input name="dob" type="date" required className="field py-2 text-sm" />
                </div>
                {searchParams.req === r.id && (searchParams.flag === 'removed' || searchParams.flag === 'duplicate') && (
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="override" className="accent-signal" />I’ve reviewed this flag and approve anyway</label>
                )}
                <p className="text-[11px] text-muted">Only a one-way fingerprint is saved — never the name or birth date.</p>
                <SubmitButton className="btn btn-primary w-full" pendingText="Checking…">Check & approve</SubmitButton>
              </form>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
