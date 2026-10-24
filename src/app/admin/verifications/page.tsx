import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import EmptyState from '@/components/EmptyState';
import VerificationCard, { RejectReasons, type Req } from './VerificationCard';
import { decideVerification } from '../actions';

export const metadata: Metadata = { title: 'Verification queue', robots: { index: false } };

export default async function VerificationQueue(
  props: { searchParams: Promise<{ req?: string; flag?: string; on?: string; why?: string }> }
) {
  const searchParams = await props.searchParams;
  const { user } = await requireAdmin('/admin/verifications');
  const admin = createAdminClient();
  const { data } = await admin
    .from('verification_requests')
    .select('id, profile_id, document_path, id_document_path, id_type, member_note, notes, created_at, profile:profiles!verification_requests_profile_id_fkey(full_name, username, avatar_url)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  const requests = (data ?? []) as unknown as Req[];

  // Short-lived links so documents are never publicly reachable.
  const sign = async (p: string | null) => (p ? (await admin.storage.from('verification-docs').createSignedUrl(p, 600)).data?.signedUrl ?? null : null);
  const links = await Promise.all(requests.map(async (r) => Promise.all([sign(r.document_path), sign(r.id_document_path)])));
  // Access log: every time an admin opens the queue, record whose documents were made viewable, by whom, and when.
  const opened = requests.filter((_, i) => links[i]?.some(Boolean));
  if (opened.length) {
    await admin.from('admin_actions').insert(opened.map((r) => ({
      admin_id: user.id, action: 'verification_docs_viewed', target_type: 'profile', target_id: r.profile_id,
      details: { request_id: r.id, files: [r.document_path ? 'service' : null, r.id_document_path ? 'photo_id' : null].filter(Boolean), link_minutes: 10 },
    })));
  }

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page py-10">
          <Link href="/admin" className="text-sm text-cream/70 hover:text-brass">← Admin</Link>
          <h1 className="mt-3 font-serif text-4xl font-medium text-ivory">Verification queue</h1>
          <p className="mt-1 text-cream/75">Oldest first. Compare the service document with the photo ID; both are deleted automatically when you approve or reject.</p>
        </div>
      </section>
      <div className="container-page max-w-6xl space-y-6 py-10">
        {requests.length === 0 && <EmptyState title="Nothing waiting for review." body="New submissions will appear here." />}
        {requests.map((r, i) => {
          const [docUrl, idUrl] = links[i] ?? [null, null];
          return (
            <VerificationCard key={r.id} r={r} docUrl={docUrl} idUrl={idUrl}
              flag={searchParams.req === r.id ? { flag: searchParams.flag, on: searchParams.on, why: searchParams.why } : null}
              reject={decideVerification.bind(null, r.id, 'failed')} approve={decideVerification.bind(null, r.id, 'verified')} />
          );
        })}
        <RejectReasons />
      </div>
    </>
  );
}
