import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import EmptyState from '@/components/EmptyState';
import SubmitButton from '@/components/SubmitButton';
import VerificationCard, { RejectReasons, type Req } from './VerificationCard';
import { decideSeparationCheck, decideVerification } from '../actions';

export const metadata: Metadata = { title: 'Verification queue', robots: { index: false } };

type SepCheck = { id: string; profile_id: string; requested_date: string; document_path: string | null; created_at: string; profile: { full_name: string; username: string | null } | null };

const day = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

export default async function VerificationQueue(
  props: { searchParams: Promise<{ req?: string; sep?: string; flag?: string; on?: string; why?: string }> }
) {
  const searchParams = await props.searchParams;
  const { user } = await requireAdmin('/admin/verifications');
  const admin = createAdminClient();
  const [{ data }, { data: sepData }] = await Promise.all([
    admin
      .from('verification_requests')
      .select('id, profile_id, document_path, id_document_path, id_type, member_note, notes, created_at, profile:profiles!verification_requests_profile_id_fkey(full_name, username, avatar_url)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    admin
      .from('separation_checks')
      .select('id, profile_id, requested_date, document_path, created_at, profile:profiles!separation_checks_profile_id_fkey(full_name, username)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
  ]);
  const requests = (data ?? []) as unknown as Req[];
  const seps = (sepData ?? []) as unknown as SepCheck[];

  // Spouse or service member, and whether an already-verified spouse is renewing (no discharge question for those).
  const ids = requests.map((r) => r.profile_id);
  const { data: vets } = ids.length
    ? await admin.from('veteran_profiles').select('profile_id, member_type, verification_status').in('profile_id', ids)
    : { data: [] as { profile_id: string; member_type: string | null; verification_status: string | null }[] };
  const vetOf = new Map((vets ?? []).map((v) => [v.profile_id as string, v]));
  for (const r of requests) {
    const v = vetOf.get(r.profile_id);
    r.member_type = (v?.member_type as string | null | undefined) ?? null;
    r.renewal = v?.verification_status === 'verified' && v?.member_type === 'spouse';
  }

  // Short-lived links so documents are never publicly reachable.
  const sign = async (p: string | null) => (p ? (await admin.storage.from('verification-docs').createSignedUrl(p, 600)).data?.signedUrl ?? null : null);
  const [links, sepLinks] = await Promise.all([
    Promise.all(requests.map(async (r) => Promise.all([sign(r.document_path), sign(r.id_document_path)]))),
    Promise.all(seps.map((c) => sign(c.document_path))),
  ]);
  // Access log: every time an admin opens the queue, record whose documents were made viewable, by whom, and when.
  const opened = requests.filter((_, i) => links[i]?.some(Boolean));
  const openedSeps = seps.filter((_, i) => sepLinks[i]);
  if (opened.length || openedSeps.length) {
    await admin.from('admin_actions').insert([
      ...opened.map((r) => ({
        admin_id: user.id, action: 'verification_docs_viewed', target_type: 'profile', target_id: r.profile_id,
        details: { request_id: r.id, files: [r.document_path ? 'service' : null, r.id_document_path ? 'photo_id' : null].filter(Boolean), link_minutes: 10 },
      })),
      ...openedSeps.map((c) => ({
        admin_id: user.id, action: 'verification_docs_viewed', target_type: 'profile', target_id: c.profile_id,
        details: { separation_check: c.id, files: ['separation'], link_minutes: 10 },
      })),
    ]);
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

        <section aria-labelledby="sep-heading" className="pt-4">
          <h2 id="sep-heading" className="font-serif text-2xl font-medium">Separation date checks</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Verified members proving the date they leave the service, which turns on free transition Pro. Match the name to their profile and the date to
            their separation or retirement orders, LES (ETS date), or DD-214 (box 12b). The file is deleted when you decide.
          </p>
          {seps.length === 0 ? <p className="card mt-4 p-5 text-sm text-muted">None waiting.</p> : (
            <ul className="mt-4 space-y-4">
              {seps.map((c, i) => (
                <li key={c.id} className="card grid gap-4 p-5 lg:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-semibold text-ink">
                      {c.profile?.full_name ?? 'Member'}
                      {c.profile?.username && <Link href={`/veterans/${c.profile.username}`} className="ml-2 text-sm font-normal text-navy underline decoration-brass underline-offset-4">profile</Link>}
                    </p>
                    <p className="text-sm text-muted">Date they entered: <strong className="text-ink">{day(c.requested_date)}</strong> · sent {day(c.created_at)}</p>
                    {sepLinks[i]
                      ? <a href={sepLinks[i]!} target="_blank" rel="noopener noreferrer" className="btn btn-outline mt-3">Open document (link works 10 minutes)</a>
                      : <p className="mt-3 text-sm text-signal">File unavailable — reject and ask them to upload it again.</p>}
                    {searchParams.sep === c.id && searchParams.flag === 'sep_date' && <p className="mt-2 text-xs font-semibold text-signal">Enter the date shown on the document to confirm.</p>}
                  </div>
                  <div className="flex flex-col gap-3">
                    <form action={decideSeparationCheck.bind(null, c.id, 'approved')} className="flex flex-wrap items-end gap-2">
                      <label className="text-xs text-muted">Date on the document
                        <input name="confirmed_date" type="date" required defaultValue={c.requested_date} className="field mt-1 py-1.5 text-sm" />
                      </label>
                      <SubmitButton className="btn btn-primary" pendingText="Saving…">Confirm date</SubmitButton>
                    </form>
                    <form action={decideSeparationCheck.bind(null, c.id, 'rejected')} className="flex flex-wrap items-end gap-2">
                      <input name="note" maxLength={300} placeholder="Reason (shown to the member)" aria-label="Reason for rejecting" className="field py-1.5 text-sm" />
                      <SubmitButton className="btn btn-outline border-signal text-signal" pendingText="Saving…">Reject</SubmitButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
