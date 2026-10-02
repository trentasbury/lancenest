import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import SubmitButton from '@/components/SubmitButton';
import { addCandidate, closeShortlist, deliverShortlist, removeCandidate } from './actions';

export const metadata: Metadata = { title: 'Shortlists', robots: { index: false } };

export default async function AdminShortlistsPage({ searchParams }: { searchParams: { error?: string } }) {
  await requireAdmin('/admin/shortlists');
  const admin = createAdminClient();
  const { data: reqs } = await admin.from('shortlist_requests').select('*, company:companies(name)').neq('status', 'awaiting_payment').order('due_at', { ascending: true }).limit(100);
  const ids = (reqs ?? []).map((r) => r.id as string);
  const { data: cands } = ids.length ? await admin.from('shortlist_candidates').select('request_id, profile_id, note, profile:profiles(full_name, username, headline)').in('request_id', ids) : { data: [] };
  return (
    <div className="container-page max-w-5xl space-y-6 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-navy">← Admin</Link>
      <h1 className="font-serif text-4xl font-medium">Verified Shortlists</h1>
      <p className="text-muted">Find 3 verified members who fit, confirm by message that they’re interested and available, add them here, then deliver. Use the Directory and candidate search to source.</p>
      {searchParams.error && <p className="text-sm text-signal">No service member with that username.</p>}
      {(reqs ?? []).length === 0 && <p className="card p-8 text-center text-muted">No shortlist requests yet.</p>}
      {(reqs ?? []).map((r) => {
        const list = ((cands ?? []) as unknown as { request_id: string; profile_id: string; note: string | null; profile: { full_name: string; username: string | null; headline: string | null } | null }[]).filter((c) => c.request_id === r.id);
        return (
          <section key={r.id as string} className="card space-y-3 p-6 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-serif text-2xl text-navy">{(r.company as { name: string } | null)?.name} · {r.role_title as string}</p>
              <span className={r.status === 'sourcing' ? 'font-semibold text-signal' : 'text-muted'}>{(r.status as string).replace('_', ' ')}{r.due_at && r.status === 'sourcing' ? ` · due ${new Date(r.due_at as string).toLocaleDateString('en-US', { dateStyle: 'medium' })}` : ''}</span>
            </div>
            <p className="text-muted">{[(r.engagement as string).replace(/_/g, ' '), r.clearance_required !== 'none' && `${r.clearance_required} (self-reported OK)`, r.location, r.pay].filter(Boolean).join(' · ')}</p>
            {r.details && <p>{r.details as string}</p>}
            {r.status === 'hired' && <p className="rounded-[3px] bg-olive/10 p-3 text-olive">Hired · salary ${((r.placement_salary_cents as number) / 100).toLocaleString()} · <strong>invoice ${((r.placement_fee_cents as number) / 100).toLocaleString()}</strong> in Stripe → Invoices</p>}
            <ul className="space-y-1">{list.map((c) => <li key={c.profile_id} className="flex justify-between gap-2"><span>{c.profile?.full_name} — {c.profile?.headline}{c.note ? ` · ${c.note}` : ''}</span><form action={removeCandidate.bind(null, r.id as string, c.profile_id)}><button className="text-xs text-muted hover:text-signal">Remove</button></form></li>)}</ul>
            {r.status === 'sourcing' && (
              <div className="flex flex-col gap-2 border-t border-line pt-3">
                <form action={addCandidate.bind(null, r.id as string)} className="flex flex-col gap-2 sm:flex-row">
                  <input name="username" required placeholder="Member username or profile link" className="field text-sm" />
                  <input name="note" placeholder="Note for the employer (e.g. interested, available in 2 weeks)" className="field text-sm" />
                  <SubmitButton className="btn btn-outline shrink-0 text-sm" pendingText="…">Add</SubmitButton>
                </form>
                <form action={deliverShortlist.bind(null, r.id as string)}><SubmitButton className="btn btn-primary text-sm" pendingText="…">Deliver shortlist ({list.length})</SubmitButton></form>
              </div>
            )}
            {['hired', 'delivered'].includes(r.status as string) && <form action={closeShortlist.bind(null, r.id as string)}><button className="text-xs text-muted hover:text-navy">Mark closed</button></form>}
          </section>
        );
      })}
    </div>
  );
}
