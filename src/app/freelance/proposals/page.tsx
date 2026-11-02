import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import FreelanceTabs from '@/components/freelance/FreelanceTabs';
import { timeAgo } from '@/lib/network';

export const metadata: Metadata = { title: 'My proposals' };

const STATUS: Record<string, [string, string]> = {
  submitted: ['Sent', 'bg-brass/10 text-brass-dark'],
  shortlisted: ['Shortlisted', 'bg-navy/10 text-navy'],
  accepted: ['Hired', 'bg-olive/10 text-olive'],
  declined: ['Not selected', 'bg-line text-muted'],
  withdrawn: ['Withdrawn', 'bg-line text-muted'],
};

type Row = { id: string; project_id: string; bid_amount: number; status: string; created_at: string; viewed_at: string | null };

/** Every proposal this member sent, newest first, with where each one stands. */
export default async function MyProposalsPage() {
  const { user, profile } = await requireVerifiedMember('/freelance/proposals');
  if (profile.role !== 'veteran') redirect('/freelance');
  const { data } = await (await createClient()).from('proposals')
    .select('id, project_id, bid_amount, status, created_at, viewed_at')
    .eq('freelancer_id', user.id).order('created_at', { ascending: false }).limit(200);
  const rows = (data ?? []) as Row[];
  // Project titles for this member's own proposals only (a closed project is no longer public, but it's still theirs to see).
  const ids = [...new Set(rows.map((r) => r.project_id))];
  const { data: projects } = ids.length
    ? await createAdminClient().from('freelance_projects').select('id, title, status, budget_type').in('id', ids)
    : { data: [] };
  const byId = new Map((projects ?? []).map((p) => [p.id as string, p as { id: string; title: string; status: string; budget_type: string }]));

  return (
    <div className="container-page max-w-4xl space-y-6 py-10">
      <FreelanceTabs active="proposals" />
      <div>
        <h1 className="font-serif text-4xl font-medium">My proposals</h1>
        <p className="mt-1 text-muted">Proposals you sent on projects. You’ll get a notification when a client shortlists or hires you.</p>
      </div>
      {rows.length === 0 ? (
        <div className="card p-8 text-center text-muted">
          You haven’t sent a proposal yet.
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/freelance#projects" className="btn btn-primary">Find freelance work</Link>
            <Link href="/freelance/services/mine" className="btn btn-outline">Offer your services</Link>
          </div>
        </div>
      ) : (
        <ul className="card divide-y divide-line">
          {rows.map((r) => {
            const p = byId.get(r.project_id);
            const [label, tone] = STATUS[r.status] ?? [r.status, 'bg-line text-muted'];
            const closed = p && p.status !== 'open' && r.status === 'submitted';
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  {p ? <Link href={`/freelance/projects/${p.id}`} className="font-medium text-navy hover:underline">{p.title}</Link> : <span className="font-medium">A project that was removed</span>}
                  <p className="text-xs text-muted">
                    Your bid ${Number(r.bid_amount).toLocaleString()}{p?.budget_type === 'hourly' ? '/hr' : ''} · sent {timeAgo(r.created_at)}
                    {r.status === 'submitted' && (r.viewed_at ? ' · seen by the client' : ' · not opened yet')}
                    {closed ? ' · project closed' : ''}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
