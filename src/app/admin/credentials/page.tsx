import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import EmptyState from '@/components/EmptyState';
import SubmitButton from '@/components/SubmitButton';
import { decideCredential } from './actions';

export const metadata: Metadata = { title: 'License & certificate reviews', robots: { index: false } };

type Row = { id: string; profile_id: string; kind: string; name: string; trade: string | null; issuer: string | null; state: string | null; number: string | null; expires_on: string | null; document_path: string | null; created_at: string; profile: { full_name: string; username: string | null } | null };

export default async function CredentialQueue() {
  const { user } = await requireAdmin('/admin/credentials');
  const admin = createAdminClient();
  const { data } = await admin.from('credentials').select('id, profile_id, kind, name, trade, issuer, state, number, expires_on, document_path, created_at, profile:profiles!credentials_profile_id_fkey(full_name, username)').eq('status', 'pending').order('created_at').limit(50);
  const rows = (data ?? []) as unknown as Row[];
  const links = await Promise.all(rows.map(async (r) => (r.document_path ? (await admin.storage.from('verification-docs').createSignedUrl(r.document_path, 600)).data?.signedUrl ?? null : null)));
  if (rows.length) await admin.from('admin_actions').insert(rows.filter((_, i) => links[i]).map((r) => ({ admin_id: user.id, action: 'credential_docs_viewed', target_type: 'profile', target_id: r.profile_id, details: { credential_id: r.id, link_minutes: 10 } })));

  return (
    <div className="container-page max-w-4xl py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-navy">← Admin</Link>
      <h1 className="mt-3 font-serif text-4xl font-medium">License & certificate reviews</h1>
      <p className="mt-2 text-sm text-muted">For trade licenses, look the number up on the state board’s public license search before approving. Approving a trade license lets the member offer that trade in Freelance.</p>
      <div className="mt-6 space-y-4">
        {rows.length === 0 && <EmptyState title="Nothing to review." body="New licenses and certificates show up here." />}
        {rows.map((r, i) => (
          <div key={r.id} className="card p-5 text-sm">
            <p className="font-semibold text-ink">{r.name} <span className="font-normal text-muted">· {r.kind === 'license' ? `${r.trade} license` : 'certificate'}</span></p>
            <p className="mt-1 text-muted">{r.profile?.username ? <Link href={`/veterans/${r.profile.username}`} className="text-navy underline">{r.profile.full_name}</Link> : r.profile?.full_name} · sent {new Date(r.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}</p>
            <p className="mt-1">{[r.state && `State: ${r.state}`, r.number && `Number: ${r.number}`, r.issuer && `Issuer: ${r.issuer}`, r.expires_on && `Expires: ${r.expires_on}`].filter(Boolean).join(' · ')}</p>
            {links[i] ? <a href={links[i]!} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-navy underline">Open the file (10-minute link)</a> : <p className="mt-2 text-signal">The file is missing (it may have expired). Reject and ask them to resend.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={decideCredential.bind(null, r.id, 'verified')}><SubmitButton className="btn btn-primary py-1.5" pendingText="…">Verify</SubmitButton></form>
              <form action={decideCredential.bind(null, r.id, 'rejected')} className="flex flex-1 gap-2">
                <input name="note" maxLength={300} placeholder="Reason (shown to the member)" className="field py-1.5" />
                <SubmitButton className="btn btn-outline py-1.5" pendingText="…">Reject</SubmitButton>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
