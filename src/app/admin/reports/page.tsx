import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import SubmitButton from '@/components/SubmitButton';
import EmptyState from '@/components/EmptyState';
import { decideReport } from '../actions';

export const metadata: Metadata = { title: 'Reports', robots: { index: false } };

type Report = { id: string; target_type: string; target_id: string; reason: string; details: string | null; created_at: string; reporter: { full_name: string } | null };

export default async function ReportsPage() {
  await requireAdmin('/admin/reports');
  const admin = createAdminClient();
  const { data } = await admin
    .from('reports')
    .select('id, target_type, target_id, reason, details, created_at, reporter:profiles!reports_reporter_id_fkey(full_name)')
    .in('status', ['open', 'reviewing'])
    .order('created_at', { ascending: true })
    .limit(100);
  const reports = (data ?? []) as unknown as Report[];

  // Resolve each reported item to something the moderator can read and open.
  const postIds = reports.filter((r) => r.target_type === 'post').map((r) => r.target_id);
  const commentIds = reports.filter((r) => r.target_type === 'comment').map((r) => r.target_id);
  const profileIds = reports.filter((r) => r.target_type === 'profile').map((r) => r.target_id);
  const [{ data: posts }, { data: comments }, { data: profiles }] = await Promise.all([
    postIds.length ? admin.from('network_posts').select('id, headline, body').in('id', postIds) : Promise.resolve({ data: [] }),
    commentIds.length ? admin.from('post_comments').select('id, post_id, body').in('id', commentIds) : Promise.resolve({ data: [] }),
    profileIds.length ? admin.from('profiles').select('id, full_name, username, role').in('id', profileIds) : Promise.resolve({ data: [] }),
  ]);
  const preview = (r: Report): { text: string; href: string | null } => {
    if (r.target_type === 'post') {
      const p = (posts ?? []).find((x) => x.id === r.target_id);
      return p ? { text: (p.headline as string) || (p.body as string), href: `/network/${p.id}` } : { text: 'Already removed', href: null };
    }
    if (r.target_type === 'comment') {
      const c = (comments ?? []).find((x) => x.id === r.target_id);
      return c ? { text: c.body as string, href: `/network/${c.post_id}#comments` } : { text: 'Already removed', href: null };
    }
    if (r.target_type === 'profile') {
      const p = (profiles ?? []).find((x) => x.id === r.target_id);
      return p ? { text: p.full_name as string, href: p.role === 'veteran' && p.username ? `/veterans/${p.username}` : null } : { text: 'Unknown member', href: null };
    }
    return { text: `${r.target_type} ${r.target_id.slice(0, 8)}`, href: null };
  };

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page py-10">
          <Link href="/admin" className="text-sm text-cream/70 hover:text-brass">← Admin</Link>
          <h1 className="mt-3 font-serif text-4xl font-medium text-ivory">Reports</h1>
          <p className="mt-1 text-cream/75">Oldest first. Removing content deletes it for everyone.</p>
        </div>
      </section>
      <div className="container-page max-w-4xl space-y-4 py-10">
        {reports.length === 0 && <EmptyState title="No open reports." body="Reports from members will appear here." />}
        {reports.map((r) => {
          const p = preview(r);
          const removable = r.target_type === 'post' || r.target_type === 'comment';
          return (
            <div key={r.id} className="card p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-signal">{r.reason.replace('_', ' ')} · {r.target_type}</p>
              <p className="mt-2 line-clamp-3 text-ink">{p.text}</p>
              {r.details && <p className="mt-2 text-sm text-muted">Reporter’s note: {r.details}</p>}
              <p className="mt-2 text-xs text-muted">Reported by {r.reporter?.full_name ?? 'a member'} · {new Date(r.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                {p.href && <Link href={p.href} className="btn btn-ghost border border-line">Open</Link>}
                {removable && (
                  <form action={decideReport.bind(null, r.id, 'removed')}>
                    <SubmitButton className="btn btn-outline border-signal text-signal hover:bg-signal hover:text-ivory" pendingText="…">Remove content</SubmitButton>
                  </form>
                )}
                <form action={decideReport.bind(null, r.id, 'resolved')}><SubmitButton className="btn btn-primary" pendingText="…">Mark resolved</SubmitButton></form>
                <form action={decideReport.bind(null, r.id, 'dismissed')}><SubmitButton className="btn btn-outline" pendingText="…">Dismiss</SubmitButton></form>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
