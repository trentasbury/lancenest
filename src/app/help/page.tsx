import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import SubmitButton from '@/components/SubmitButton';
import { submitSupportRequest } from './actions';
import { KINDS, KIND_LABEL, STATUS_LABEL } from './kinds';

export const metadata: Metadata = {
  alternates: { canonical: '/help' }, title: 'Help & feedback',
  description: 'Ask for help, report a bug, or suggest a feature for LanceNest.',
};

const ERR: Record<string, string> = {
  missing: 'Add a short subject and a few words about what happened.',
  email: 'Add an email address so we can reply.',
  pii: 'That looks like a Social Security number. Please remove it — we never need it here.',
  busy: 'You’ve sent several messages in the last hour. Please wait a bit, or add to an earlier one when we reply.',
  save: 'That didn’t send. Please try again.',
};

const QUICK: [string, string][] = [
  ['/forgot-password', 'Trouble signing in? Reset your password'],
  ['/trust', 'How verification works'],
  ['/payments-protection', 'Freelance payments and disputes'],
  ['/privacy', 'Your privacy and data'],
  ['/conduct', 'Code of conduct'],
];

type Req = { id: string; kind: string; subject: string; status: string; admin_reply: string | null; created_at: string };

export default async function HelpPage(
  props: { searchParams: Promise<{ kind?: string; sent?: string; error?: string; from?: string; subject?: string }> }
) {
  const searchParams = await props.searchParams;
  const session = await getSessionProfile();
  const kind = KINDS.some(([v]) => v === searchParams.kind) ? searchParams.kind : 'support';
  // Pre-fill "which page" from the link that brought them here (same-site paths only).
  const ref = (await headers()).get('referer');
  let from = searchParams.from?.startsWith('/') ? searchParams.from : '';
  if (!from && ref) {
    try { const u = new URL(ref); if (/lancenest\.com$|localhost$/.test(u.hostname) && u.pathname !== '/help') from = u.pathname + u.search; } catch { /* ignore */ }
  }
  const { data: mine } = session
    ? await (await createClient()).from('support_requests').select('id, kind, subject, status, admin_reply, created_at').order('created_at', { ascending: false }).limit(20)
    : { data: [] };
  const requests = (mine ?? []) as Req[];

  return (
    <div className="container-page py-10">
      <div className="max-w-2xl">
        <p className="eyebrow">Help & feedback</p>
        <h1 className="mt-2 font-sans text-3xl font-bold tracking-tight text-ink sm:text-4xl">How can we help?</h1>
        <p className="mt-2 text-muted">Ask a question, report something that’s broken, or tell us what to build next. A real person reads every message.</p>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {searchParams.sent ? (
            <div className="card border-olive/40 p-6" role="status">
              <p className="font-sans text-lg font-semibold text-ink">Thanks — we got it.</p>
              <p className="mt-1 text-sm text-muted">{session ? 'You’ll see our reply below and in your notifications.' : 'We’ll reply to the email address you gave us.'}</p>
              <Link href="/help" className="btn btn-outline mt-4">Send something else</Link>
            </div>
          ) : (
            <form action={submitSupportRequest} className="card space-y-5 p-6 sm:p-7">
              {searchParams.error && <p role="alert" className="rounded-lg border border-signal/30 bg-signal/5 px-3.5 py-2.5 text-sm text-signal">{ERR[searchParams.error] ?? ERR.save}</p>}
              <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

              <fieldset>
                <legend className="field-label">What’s this about?</legend>
                <div className="mt-1 grid gap-3 sm:grid-cols-3">
                  {KINDS.map(([v, title, hint]) => (
                    <label key={v} className="cursor-pointer">
                      <input type="radio" name="kind" value={v} defaultChecked={v === kind} className="peer sr-only" />
                      <span className="block h-full rounded-xl border border-line p-4 transition-colors hover:border-brass peer-checked:border-navy peer-checked:bg-navy/[0.04] peer-checked:ring-1 peer-checked:ring-navy peer-focus-visible:ring-2 peer-focus-visible:ring-brass">
                        <span className="block font-semibold text-ink">{title}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted">{hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {!session && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label htmlFor="name" className="field-label">Your name</label><input id="name" name="name" maxLength={120} autoComplete="name" className="field" /></div>
                  <div><label htmlFor="email" className="field-label">Email for our reply</label><input id="email" name="email" type="email" required maxLength={200} autoComplete="email" className="field" /></div>
                </div>
              )}
              <div>
                <label htmlFor="subject" className="field-label">Subject</label>
                <input id="subject" name="subject" required minLength={3} maxLength={140} defaultValue={searchParams.subject?.slice(0, 140)} placeholder="e.g. My verification is stuck, or: Let employers filter by certification" className="field" />
              </div>
              <div>
                <label htmlFor="details" className="field-label">Details</label>
                <textarea id="details" name="details" required minLength={10} maxLength={4000} rows={6} className="field"
                  placeholder="For a problem: what you did, what happened, and what you expected. For an idea: what you’d like and how it would help you." />
              </div>
              <div>
                <label htmlFor="page_url" className="field-label">Which page? <span className="font-normal text-muted">(optional)</span></label>
                <input id="page_url" name="page_url" defaultValue={from} maxLength={500} placeholder="/jobs" className="field" />
              </div>
              <p className="text-xs text-muted">Please don’t include your Social Security number, passwords, or service documents. We’ll never ask for them here.</p>
              <SubmitButton className="btn btn-primary" pendingText="Sending…">Send</SubmitButton>
            </form>
          )}

          {session && (
            <section id="requests" className="scroll-mt-24">
              <h2 className="font-sans text-lg font-semibold text-ink">Your messages</h2>
              {requests.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Nothing yet. Anything you send shows up here with our reply.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {requests.map((r) => (
                    <li key={r.id} className="card p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-ink">{r.subject}</p>
                          <p className="text-xs text-muted">{KIND_LABEL[r.kind]} · {new Date(r.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}</p>
                        </div>
                        <span className={`pill ${r.status === 'done' ? 'border-olive/40 bg-olive/10 text-olive' : r.status === 'new' ? '' : 'border-brass/50 bg-brass/10 text-brass-dark'}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                      </div>
                      {r.admin_reply && (
                        <div className="mt-3 rounded-xl border border-line bg-paper px-4 py-3 text-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Reply from LanceNest</p>
                          <p className="mt-1 whitespace-pre-line text-ink/90">{r.admin_reply}</p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card p-6">
            <h2 className="font-sans text-base font-semibold text-ink">Quick answers</h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              {QUICK.map(([href, label]) => <li key={href}><Link href={href} className="text-navy hover:underline">{label} →</Link></li>)}
            </ul>
          </div>
          <div className="card p-6 text-sm text-muted">
            <h2 className="font-sans text-base font-semibold text-ink">Reporting a person or post?</h2>
            <p className="mt-2">Use <strong className="text-ink">Report</strong> on their profile, post, message, or job so our moderators see exactly what you saw.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
