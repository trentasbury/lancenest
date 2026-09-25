import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import SubmitButton from '@/components/SubmitButton';
import EmptyState from '@/components/EmptyState';
import { decideVerification } from '../actions';

export const metadata: Metadata = { title: 'Verification queue', robots: { index: false } };

type Req = { id: string; profile_id: string; document_path: string | null; notes: string | null; created_at: string; profile: { full_name: string; username: string | null } | null };

export default async function VerificationQueue() {
  await requireRole(['admin'], '/admin/verifications');
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
                  <input id={`note-${r.id}`} name="note" maxLength={300} placeholder="e.g. Name on document doesn’t match profile" className="field" />
                </div>
                <SubmitButton className="btn btn-outline border-signal text-signal hover:bg-signal hover:text-ivory" pendingText="Saving…">Reject</SubmitButton>
              </form>
              <form action={decideVerification.bind(null, r.id, 'verified')}>
                <SubmitButton className="btn btn-primary w-full" pendingText="Saving…">Approve</SubmitButton>
              </form>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
