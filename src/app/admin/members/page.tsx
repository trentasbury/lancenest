import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import SubmitButton from '@/components/SubmitButton';
import { sanitizeSearch } from '@/lib/format';
import { actOnMember } from '../actions';

export const metadata: Metadata = { title: 'Members', robots: { index: false } };

export default async function MembersAdmin({ searchParams }: { searchParams: { q?: string; id?: string; done?: string; err?: string } }) {
  await requireAdmin('/admin/members');
  const admin = createAdminClient();
  const q = sanitizeSearch(searchParams.q ?? '');
  const { data: results } = q
    ? await admin.from('profiles').select('id, full_name, username, role, banned, suspended_until').ilike('full_name', `%${q}%`).limit(25)
    : { data: [] };
  const id = searchParams.id;
  const [{ data: member }, { data: strikes }, { data: reports }] = id
    ? await Promise.all([
        admin.from('profiles').select('id, full_name, username, role, banned, suspended_until, created_at').eq('id', id).maybeSingle(),
        admin.from('member_strikes').select('level, reason, created_at').eq('profile_id', id).order('created_at', { ascending: false }),
        admin.from('reports').select('id, reason, details, status, created_at').eq('target_type', 'profile').eq('target_id', id).order('created_at', { ascending: false }),
      ])
    : [{ data: null }, { data: [] }, { data: [] }];
  const strikeCount = (strikes ?? []).filter((s) => s.level === 'warning' || s.level === 'suspension').length;
  const suggested = strikeCount === 0 ? 'warning' : strikeCount === 1 ? 'suspension' : 'removal';
  const openReport = (reports ?? []).find((r) => r.status === 'open');

  return (
    <>
      <section className="bg-navy-deep text-ivory"><div className="container-page py-10">
        <Link href="/admin" className="text-sm text-cream/70 hover:text-brass">← Admin</Link>
        <h1 className="mt-3 font-serif text-4xl font-medium text-ivory">Members & conduct</h1>
        <p className="mt-1 text-cream/75">Three strikes: warning → 7-day suspension → removal. Severe violations can go straight to removal.</p>
      </div></section>
      <div className="container-page max-w-4xl space-y-6 py-10">
        <form method="get" className="flex gap-2"><input name="q" defaultValue={searchParams.q} placeholder="Search members by name" className="field" /><button className="btn btn-primary">Search</button></form>
        {(results ?? []).length > 0 && (
          <ul className="card divide-y divide-line">
            {(results ?? []).map((m) => (
              <li key={m.id as string}><Link href={`/admin/members?id=${m.id}`} className="flex justify-between p-4 hover:bg-paper">
                <span>{m.full_name as string} <span className="text-xs capitalize text-muted">· {m.role as string}</span></span>
                <span className="text-xs">{m.banned ? <span className="text-signal">Removed</span> : m.suspended_until && new Date(m.suspended_until as string) > new Date() ? <span className="text-brass-dark">Suspended</span> : 'Active'}</span>
              </Link></li>
            ))}
          </ul>
        )}

        {member && (
          <section className="card space-y-5 p-7">
            {searchParams.done && <p className="text-sm text-olive">Done — {searchParams.done} recorded.</p>}
            {searchParams.err && <p className="text-sm text-signal">Write a reason — it’s logged and shown to the member.</p>}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-serif text-3xl">{member.full_name as string}</p>
                <p className="text-sm capitalize text-muted">{member.role as string} · joined {new Date(member.created_at as string).toLocaleDateString('en-US', { dateStyle: 'medium' })}</p>
              </div>
              {member.username && member.role === 'veteran' && <Link href={`/veterans/${member.username}`} className="btn btn-ghost border border-line">View profile</Link>}
            </div>
            <p className="text-sm">Status: {member.banned ? <span className="font-semibold text-signal">Removed</span> : member.suspended_until && new Date(member.suspended_until as string) > new Date() ? <span className="font-semibold text-brass-dark">Suspended until {new Date(member.suspended_until as string).toLocaleDateString()}</span> : <span className="font-semibold text-olive">Active</span>} · Strikes: {strikeCount}</p>

            <div><p className="eyebrow">Reports about this member ({(reports ?? []).length})</p>
              <ul className="mt-2 space-y-2 text-sm">{(reports ?? []).map((r) => <li key={r.id as string} className="rounded-[3px] border border-line p-3"><span className="font-medium capitalize">{String(r.reason).replace('_', ' ')}</span> · {r.status as string} · {new Date(r.created_at as string).toLocaleDateString()}{r.details && <p className="text-muted">{r.details as string}</p>}</li>)}</ul>
            </div>
            <div><p className="eyebrow">Conduct log</p>
              {(strikes ?? []).length === 0 ? <p className="mt-2 text-sm text-muted">No actions yet.</p> : <ul className="mt-2 space-y-2 text-sm">{(strikes ?? []).map((s, i) => <li key={i}><span className="font-semibold capitalize">{s.level as string}</span> · {new Date(s.created_at as string).toLocaleString()} — {s.reason as string}</li>)}</ul>}
            </div>

            {!member.banned ? (
              <div className="space-y-3 border-t border-line pt-5">
                <p className="text-sm">Recommended next step: <strong className="capitalize">{suggested}</strong></p>
                {(['warning', 'suspension', 'removal'] as const).map((a) => (
                  <form key={a} action={actOnMember.bind(null, member.id as string, a)} className="flex flex-col gap-2 sm:flex-row">
                    {openReport && <input type="hidden" name="report_id" value={openReport.id as string} />}
                    <input name="reason" required placeholder={`Reason for ${a} (logged and shown to the member)`} className="field" />
                    <SubmitButton className={`btn shrink-0 ${a === 'removal' ? 'border border-signal text-signal hover:bg-signal hover:text-ivory' : a === 'suspension' ? 'btn-outline' : 'btn-ghost border border-line'}`} pendingText="…">
                      {a === 'warning' ? 'Warn' : a === 'suspension' ? 'Suspend 7 days' : 'Remove from LanceNest'}
                    </SubmitButton>
                  </form>
                ))}
              </div>
            ) : (
              <form action={actOnMember.bind(null, member.id as string, 'reinstated')} className="flex gap-2 border-t border-line pt-5">
                <input name="reason" required placeholder="Reason for reinstating (e.g. appeal granted)" className="field" />
                <SubmitButton className="btn btn-outline shrink-0" pendingText="…">Reinstate</SubmitButton>
              </form>
            )}
          </section>
        )}
      </div>
    </>
  );
}
