import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { categoryLabel } from '@/lib/groups';
import SubmitButton from '@/components/SubmitButton';
import { reviewGroup } from './actions';

export const metadata: Metadata = { title: 'Group requests', robots: { index: false } };

type Row = {
  id: string; slug: string; name: string; category: string | null; privacy: string; status: string; description: string | null;
  purpose: string | null; review_note: string | null; created_at: string;
  starter: { full_name: string; username: string | null; role: string } | null;
};
const d = (x: string) => new Date(x).toLocaleDateString('en-US', { dateStyle: 'medium' });

/** Member-started groups: requests to review first, then live and closed groups. */
export default async function AdminGroups() {
  await requireAdmin('/admin/groups');
  const admin = createAdminClient();
  const cols = 'id, slug, name, category, privacy, status, description, purpose, review_note, created_at, starter:profiles!groups_created_by_fkey(full_name, username, role)';
  const [{ data: pending }, { data: live }, { data: closed }] = await Promise.all([
    admin.from('groups').select(cols).is('kind', null).eq('status', 'pending').order('created_at').limit(200),
    admin.from('groups').select(cols).is('kind', null).eq('status', 'approved').order('created_at', { ascending: false }).limit(200),
    admin.from('groups').select(cols).is('kind', null).in('status', ['rejected', 'archived']).order('created_at', { ascending: false }).limit(100),
  ]);
  const Starter = ({ r }: { r: Row }) => r.starter?.username && r.starter.role === 'veteran'
    ? <Link href={`/veterans/${r.starter.username}`} className="text-navy underline">{r.starter.full_name}</Link>
    : <span>{r.starter?.full_name ?? 'Former member'}</span>;

  return (
    <div className="container-page max-w-4xl py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-navy">← Admin</Link>
      <h1 className="mt-3 font-serif text-4xl font-medium">Member groups</h1>
      <p className="mt-2 text-muted">Approve groups that have a clear, legitimate purpose. Decline anything that impersonates an official unit or LanceNest, targets or excludes people in a hateful way, sells or recruits for off-platform work, or risks OPSEC. Your note is shown to the member.</p>

      <section className="mt-8">
        <h2 className="font-serif text-2xl font-medium">Waiting for review <span className="text-base text-muted">({(pending ?? []).length})</span></h2>
        <ul className="mt-3 space-y-4">
          {(pending ?? []).length === 0 && <li className="card p-4 text-sm text-muted">Nothing waiting.</li>}
          {((pending ?? []) as unknown as Row[]).map((r) => (
            <li key={r.id} className="card space-y-3 p-5 text-sm">
              <div>
                <p className="text-lg font-semibold text-ink">{r.name}</p>
                <p className="text-xs text-muted">{categoryLabel(r.category)} · {r.privacy === 'private' ? 'Private' : 'Open'} · requested {d(r.created_at)} by <Starter r={r} /></p>
              </div>
              <div><p className="field-label">Description (public)</p><p className="whitespace-pre-line">{r.description}</p></div>
              <div><p className="field-label">Why they’re starting it</p><p className="whitespace-pre-line">{r.purpose}</p></div>
              <form className="space-y-2">
                <textarea name="note" rows={2} maxLength={500} className="field" placeholder="Note to the member (shown on their Groups page). Please explain if you decline." />
                <div className="flex gap-2">
                  <button formAction={reviewGroup.bind(null, r.id, 'approve')} className="btn btn-primary py-1.5 text-xs">Approve</button>
                  <button formAction={reviewGroup.bind(null, r.id, 'reject')} className="btn btn-outline py-1.5 text-xs">Decline</button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl font-medium">Live <span className="text-base text-muted">({(live ?? []).length})</span></h2>
        <ul className="card mt-3 divide-y divide-line">
          {(live ?? []).length === 0 && <li className="p-4 text-sm text-muted">None yet.</li>}
          {((live ?? []) as unknown as Row[]).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <span><Link href={`/groups/${r.slug}`} className="font-semibold text-navy underline">{r.name}</Link><span className="block text-xs text-muted">{categoryLabel(r.category)} · {r.privacy} · started by <Starter r={r} /></span></span>
              <form action={reviewGroup.bind(null, r.id, 'archive')}><SubmitButton className="btn btn-ghost py-1.5 text-xs" pendingText="…">Close group</SubmitButton></form>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl font-medium">Declined or closed</h2>
        <ul className="card mt-3 divide-y divide-line">
          {(closed ?? []).length === 0 && <li className="p-4 text-sm text-muted">None.</li>}
          {((closed ?? []) as unknown as Row[]).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <span><strong>{r.name}</strong><span className="block text-xs text-muted">{r.status === 'rejected' ? 'Declined' : 'Closed'}{r.review_note ? ` · “${r.review_note}”` : ''}</span></span>
              <form action={reviewGroup.bind(null, r.id, 'reopen')}><SubmitButton className="btn btn-ghost py-1.5 text-xs" pendingText="…">{r.status === 'rejected' ? 'Approve after all' : 'Reopen'}</SubmitButton></form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
