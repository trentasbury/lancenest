import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import StatCard from '@/components/StatCard';

export const metadata: Metadata = { title: 'Admin', robots: { index: false } };

type Recent = { id: string; full_name: string; role: string; created_at: string };

export default async function AdminPage() {
  // Server-side role check FIRST — only then use the service-role client.
  await requireRole(['admin'], '/admin');
  const admin = createAdminClient();

  const countOf = async (table: string, filter?: { column: string; value: string }) => {
    let q = admin.from(table).select('*', { count: 'exact', head: true });
    if (filter) q = q.eq(filter.column, filter.value);
    const { count } = await q;
    return count ?? 0;
  };

  const [veterans, employers, openJobs, companies, pendingVerifications, openReports, recentRes] = await Promise.all([
    countOf('profiles', { column: 'role', value: 'veteran' }),
    countOf('profiles', { column: 'role', value: 'employer' }),
    countOf('jobs', { column: 'status', value: 'open' }),
    countOf('companies'),
    countOf('verification_requests', { column: 'status', value: 'pending' }),
    countOf('reports', { column: 'status', value: 'open' }),
    admin.from('profiles').select('id, full_name, role, created_at').order('created_at', { ascending: false }).limit(10),
  ]);

  const recent = (recentRes.data ?? []) as Recent[];

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page py-12">
          <p className="eyebrow text-brass">Administration</p>
          <h1 className="mt-3 font-serif text-5xl font-medium text-ivory">Platform overview</h1>
        </div>
      </section>
      <div className="container-page space-y-10 py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Veterans" value={veterans} />
          <StatCard label="Employers" value={employers} />
          <StatCard label="Companies" value={companies} />
          <StatCard label="Open jobs" value={openJobs} />
          <Link href="/admin/verifications" className="transition-opacity hover:opacity-80">
            <StatCard label="Pending verifications →" value={pendingVerifications} hint="Open the review queue" />
          </Link>
          <Link href="/admin/reports" className="transition-opacity hover:opacity-80">
            <StatCard label="Open reports →" value={openReports} hint="Open the moderation queue" />
          </Link>
        </div>
        <section>
          <h2 className="eyebrow">Newest members</h2>
          <div className="card mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-muted">
                <tr><th className="p-4">Name</th><th className="p-4">Role</th><th className="p-4">Joined</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td className="p-4 text-ink">{r.full_name || '—'}</td>
                    <td className="p-4 capitalize text-muted">{r.role}</td>
                    <td className="p-4 text-muted">{new Date(r.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}</td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr><td colSpan={3} className="p-6 text-center text-muted">No members yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
