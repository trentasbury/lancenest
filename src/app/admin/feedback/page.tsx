import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import SubmitButton from '@/components/SubmitButton';
import { KIND_LABEL, STATUSES, STATUS_LABEL } from '@/app/help/kinds';
import { updateSupportRequest } from './actions';

export const metadata: Metadata = { title: 'Help & feedback', robots: { index: false } };

const VIEWS: [string, string][] = [['open', 'Open'], ['bug', 'Bugs'], ['idea', 'Ideas'], ['support', 'Help requests'], ['closed', 'Done & closed']];
const OPEN = ['new', 'in_progress', 'planned'];

type Row = {
  id: string; kind: string; subject: string; details: string; page_url: string | null; status: string; admin_reply: string | null;
  name: string | null; email: string | null; created_at: string;
  profile: { full_name: string; username: string | null; role: string } | null;
};

export default async function FeedbackQueue({ searchParams }: { searchParams: { view?: string } }) {
  await requireAdmin('/admin/feedback');
  const view = VIEWS.some(([v]) => v === searchParams.view) ? searchParams.view! : 'open';
  const admin = createAdminClient();
  let q = admin.from('support_requests').select('*, profile:profiles(full_name, username, role)');
  if (view === 'closed') q = q.in('status', ['done', 'closed']);
  else q = q.in('status', OPEN);
  if (['bug', 'idea', 'support'].includes(view)) q = q.eq('kind', view);
  const [{ data }, { count: openCount }] = await Promise.all([
    q.order('created_at', { ascending: false }).limit(100),
    admin.from('support_requests').select('id', { count: 'exact', head: true }).eq('status', 'new'),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const back = `/admin/feedback${view === 'open' ? '' : `?view=${view}`}`;

  return (
    <div className="container-page max-w-4xl space-y-6 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-navy">← Admin</Link>
      <div>
        <h1 className="font-serif text-4xl font-medium">Help & feedback</h1>
        <p className="mt-1 text-sm text-muted">{openCount ?? 0} new · members see your status and reply on their Help page.</p>
      </div>
      <nav className="flex flex-wrap gap-2">
        {VIEWS.map(([v, label]) => (
          <Link key={v} href={v === 'open' ? '/admin/feedback' : `/admin/feedback?view=${v}`}
            className={`rounded-full border px-4 py-1.5 text-sm ${view === v ? 'border-navy bg-navy text-ivory' : 'border-line bg-ivory text-ink hover:border-brass'}`}>{label}</Link>
        ))}
      </nav>
      {rows.length === 0 && <p className="card p-8 text-center text-muted">Nothing here.</p>}
      {rows.map((r) => (
        <div key={r.id} className="card space-y-3 p-5 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{KIND_LABEL[r.kind]} · {STATUS_LABEL[r.status]}</p>
              <p className="mt-1 font-serif text-xl text-navy">{r.subject}</p>
            </div>
            <span className="text-xs text-muted">{new Date(r.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>
          <p className="text-muted">
            From {r.profile?.username ? <Link href={`/veterans/${r.profile.username}`} className="text-navy underline">{r.profile.full_name}</Link> : (r.profile?.full_name ?? r.name ?? 'a visitor')}
            {r.profile && <span className="capitalize"> · {r.profile.role}</span>}
            {r.email && <> · <a href={`mailto:${r.email}?subject=${encodeURIComponent(`Re: ${r.subject}`)}`} className="text-navy underline">{r.email}</a></>}
            {!r.profile && ' · signed out'}
            {r.page_url && <> · page <code className="rounded bg-paper px-1">{r.page_url}</code></>}
          </p>
          <p className="whitespace-pre-line text-ink/90">{r.details}</p>
          <form action={updateSupportRequest.bind(null, r.id, back)} className="grid gap-3 border-t border-line pt-3 sm:grid-cols-[200px_1fr_auto] sm:items-end">
            <div><label className="field-label" htmlFor={`st-${r.id}`}>Status</label>
              <select id={`st-${r.id}`} name="status" defaultValue={r.status} className="field py-2 text-sm">{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div><label className="field-label" htmlFor={`rp-${r.id}`}>Reply (shown to them)</label>
              <textarea id={`rp-${r.id}`} name="reply" rows={2} maxLength={2000} defaultValue={r.admin_reply ?? ''} className="field py-2 text-sm" /></div>
            <SubmitButton className="btn btn-primary" pendingText="Saving…">Save</SubmitButton>
          </form>
        </div>
      ))}
    </div>
  );
}
