import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import SubmitButton from '@/components/SubmitButton';
import { adminSpouseLink } from './actions';

export const metadata: Metadata = { title: 'Military spouses', robots: { index: false } };

type Row = { spouse_id: string; sponsor_id: string | null; method: string; confirmed_until: string | null; grace_until: string | null; surviving: boolean; spouse: { full_name: string; username: string | null } | null };
const d = (x: string | null) => (x ? new Date(x).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '—');

/** Spouse links that need attention: in the grace period, or due within 30 days. Surviving spouses are listed last. */
export default async function AdminSpouses() {
  await requireAdmin('/admin/spouses');
  const admin = createAdminClient();
  const soon = new Date(Date.now() + 30 * 86400000).toISOString();
  const cols = 'spouse_id, sponsor_id, method, confirmed_until, grace_until, surviving, spouse:profiles!spouse_links_spouse_id_fkey(full_name, username)';
  const [{ data: grace }, { data: due }, { data: surviving }, { count: total }] = await Promise.all([
    admin.from('spouse_links').select(cols).eq('surviving', false).not('grace_until', 'is', null).order('grace_until').limit(200),
    admin.from('spouse_links').select(cols).eq('surviving', false).is('grace_until', null).lte('confirmed_until', soon).order('confirmed_until').limit(200),
    admin.from('spouse_links').select(cols).eq('surviving', true).limit(200),
    admin.from('spouse_links').select('spouse_id', { count: 'exact', head: true }),
  ]);
  const groups: [string, string, Row[]][] = [
    ['In grace period', 'Status ends on the date shown unless renewed. Pending renewal documents pause the end date.', (grace ?? []) as unknown as Row[]],
    ['Due in the next 30 days', 'Reminders go out automatically a month before.', (due ?? []) as unknown as Row[]],
    ['Surviving spouses', 'Never expire.', (surviving ?? []) as unknown as Row[]],
  ];

  return (
    <div className="container-page max-w-4xl py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-navy">← Admin</Link>
      <h1 className="mt-3 font-serif text-4xl font-medium">Military spouses</h1>
      <p className="mt-2 text-muted">{(total ?? 0).toLocaleString()} verified spouse links. Each is confirmed once a year by the service member or with documents; a missed year starts a 90-day grace period, then the status ends.</p>
      {groups.map(([title, hint, rows]) => (
        <section key={title} className="mt-8">
          <h2 className="font-serif text-2xl font-medium">{title} <span className="text-base text-muted">({rows.length})</span></h2>
          <p className="text-sm text-muted">{hint}</p>
          <ul className="card mt-3 divide-y divide-line">
            {rows.length === 0 && <li className="p-4 text-sm text-muted">None.</li>}
            {rows.map((r) => (
              <li key={r.spouse_id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <span>
                  {r.spouse?.username ? <Link href={`/veterans/${r.spouse.username}`} className="font-semibold text-navy underline decoration-brass underline-offset-4">{r.spouse.full_name}</Link> : <strong>{r.spouse?.full_name ?? 'Member'}</strong>}
                  <span className="block text-xs text-muted">
                    {r.method === 'sponsor_invite' ? (r.sponsor_id ? 'Linked by invite' : 'Invite link removed') : 'Verified by documents'}
                    {!r.surviving && (r.grace_until ? ` · ends ${d(r.grace_until)}` : ` · confirmed until ${d(r.confirmed_until)}`)}
                  </span>
                </span>
                {!r.surviving && (
                  <span className="flex gap-2">
                    <form action={adminSpouseLink.bind(null, r.spouse_id, 'extend')}><SubmitButton className="btn btn-outline py-1.5 text-xs" pendingText="…">Extend a year</SubmitButton></form>
                    <form action={adminSpouseLink.bind(null, r.spouse_id, 'surviving')}><SubmitButton className="btn btn-ghost py-1.5 text-xs" pendingText="…">Mark surviving spouse</SubmitButton></form>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="mt-6 text-xs text-muted">Only extend or mark surviving after checking documents (a VA survivor benefits letter, or current orders listing them as a dependent). Every change is logged.</p>
    </div>
  );
}
