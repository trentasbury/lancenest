import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import SubmitButton from '@/components/SubmitButton';
import { AUDIENCES } from '@/lib/announcements';
import { US_STATES } from '@/lib/states';
import { sendAnnouncement, stopAnnouncementEmails } from './actions';

export const metadata: Metadata = { title: 'Announcements', robots: { index: false } };

const ERR: Record<string, string> = {
  title: 'Add a title of at least 4 characters.', audience: 'Choose who gets it.', state: 'Choose a state.',
  link: 'Links must start with / (a LanceNest page) or https://.', confirm: 'Tick the box to confirm who it goes to.', save: 'That didn’t send. Please try again.',
};

type Row = { id: string; title: string; audience: keyof typeof AUDIENCES; state: string | null; send_email: boolean; email_done: boolean; recipients: number; pushed: number; emailed: number; created_at: string };

export default async function AdminAnnouncements(props: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const sp = await props.searchParams;
  await requireAdmin('/admin/announcements');
  const { data } = await createAdminClient().from('announcements')
    .select('id, title, audience, state, send_email, email_done, recipients, pushed, emailed, created_at').order('created_at', { ascending: false }).limit(30);
  const rows = (data ?? []) as Row[];
  const perDay = Number(process.env.ANNOUNCEMENT_EMAILS_PER_DAY ?? 60) || 60;

  return (
    <div className="container-page max-w-3xl py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-navy">← Admin</Link>
      <h1 className="mt-3 font-serif text-4xl font-medium">Announcements</h1>
      <p className="mt-2 text-muted">Events, pop-ups, new features and news. Everyone in the audience gets it in their notifications right away, and on their phone if they turned that on. Email is optional and goes out about {perDay} a day, oldest announcement first, skipping anyone who unsubscribed from updates.</p>
      {sp.error && <p role="alert" className="mt-4 text-sm text-signal">{ERR[sp.error] ?? ERR.save}</p>}
      {sp.sent && <p className="mt-4 text-sm text-olive">Sent to {Number(sp.sent).toLocaleString()} {Number(sp.sent) === 1 ? 'person' : 'people'}.</p>}

      <form action={sendAnnouncement} className="card mt-6 grid gap-4 p-6 sm:grid-cols-2">
        <div className="sm:col-span-2"><label htmlFor="an-title" className="field-label">Title</label>
          <input id="an-title" name="title" required minLength={4} maxLength={120} placeholder="Hiring pop-up at Fort Bragg, Nov 14" className="field" /></div>
        <div className="sm:col-span-2"><label htmlFor="an-body" className="field-label">Details <span className="font-normal text-muted">(optional, up to 600 characters)</span></label>
          <textarea id="an-body" name="body" maxLength={600} rows={3} className="field" placeholder="Where, when, who’s hiring, what to bring." /></div>
        <div className="sm:col-span-2"><label htmlFor="an-link" className="field-label">Link <span className="font-normal text-muted">(optional: a LanceNest page like /fairs, or https://…)</span></label>
          <input id="an-link" name="link" maxLength={300} placeholder="/fairs" className="field" /></div>
        <div><label htmlFor="an-aud" className="field-label">Who gets it</label>
          <select id="an-aud" name="audience" required className="field" defaultValue="everyone">
            {Object.entries(AUDIENCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div><label htmlFor="an-state" className="field-label">State <span className="font-normal text-muted">(for “Members in one state”)</span></label>
          <select id="an-state" name="state" className="field" defaultValue=""><option value="">—</option>{US_STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></div>
        <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" name="send_email" className="mt-0.5 accent-navy" />Also email it (in daily batches)</label>
        <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" name="confirm" required className="mt-0.5 accent-signal" />I checked the wording and the audience. This can’t be unsent.</label>
        <div className="sm:col-span-2"><SubmitButton className="btn btn-primary" pendingText="Sending…">Send announcement</SubmitButton></div>
      </form>

      <h2 className="mt-10 font-serif text-2xl font-medium">Sent</h2>
      <ul className="card mt-3 divide-y divide-line">
        {rows.length === 0 && <li className="p-5 text-sm text-muted">Nothing sent yet.</li>}
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <span>
              <strong>{r.title}</strong>
              <span className="block text-xs text-muted">
                {new Date(r.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })} · {AUDIENCES[r.audience]}{r.state ? ` (${r.state})` : ''} · {r.recipients.toLocaleString()} in-app · {r.pushed.toLocaleString()} phones
                {r.send_email && ` · ${r.emailed.toLocaleString()} emailed${r.email_done ? '' : ' so far'}`}
              </span>
            </span>
            {r.send_email && !r.email_done && <form action={stopAnnouncementEmails.bind(null, r.id)}><SubmitButton className="btn btn-ghost py-1.5 text-xs text-signal" pendingText="…">Stop emails</SubmitButton></form>}
          </li>
        ))}
      </ul>
    </div>
  );
}
