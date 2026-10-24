import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { getMyCompany } from '@/lib/employer';
import { createAdminClient } from '@/lib/supabase/admin';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { SECRET_BOX_READY } from '@/lib/secretBox';
import { ATS_LABEL, type AtsProvider } from '@/lib/atsPush';
import { disconnect, saveConnection, setAutoSend } from './actions';

export const metadata: Metadata = { title: 'Your hiring system' };

const ERR: Record<string, string> = {
  owner: 'Only the account owner of a verified company can connect a hiring system.', off: 'Connecting a hiring system isn’t switched on yet.',
  provider: 'Pick Greenhouse, Lever or Ashby.', board: 'Add your board token (Greenhouse) or site name (Lever): letters, numbers, dashes.', key: 'Paste the full API key.',
};

export default async function HiringSystemPage(props: { searchParams: Promise<{ error?: string; saved?: string; removed?: string }> }) {
  const sp = await props.searchParams;
  const { user } = await requireRole(['employer'], '/employer/hiring-system');
  const company = await getMyCompany(user.id);
  if (!company) redirect('/employer/dashboard');
  const admin = createAdminClient();
  const [{ data: conn }, { data: feed }, { data: recent }] = await Promise.all([
    admin.from('ats_connections').select('provider, board, key_hint, auto_send, last_error, updated_at').eq('company_id', company.id).maybeSingle(),
    admin.from('job_feeds').select('kind, source').eq('company_id', company.id).maybeSingle(),
    admin.from('ats_deliveries').select('status, error, sent_at').eq('company_id', company.id).order('sent_at', { ascending: false }).limit(10),
  ]);
  const ready = SECRET_BOX_READY();
  const sent = (recent ?? []).filter((r) => r.status === 'sent').length;
  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <Link href="/employer/dashboard" className="text-sm text-muted hover:text-navy">← Employer dashboard</Link>
      <div>
        <h1 className="font-serif text-4xl font-medium">Send applicants to your hiring system</h1>
        <p className="mt-2 text-muted">Connect Greenhouse, Lever or Ashby and LanceNest applicants land there with their résumé, screening answers and a link to their verified profile. It works for jobs you imported from that system.</p>
      </div>
      {sp.error && <FormMessage error={ERR[sp.error] ?? ERR.key} />}
      {sp.saved && <FormMessage message="Connected. Your API key is encrypted and won’t be shown again." />}
      {sp.removed && <FormMessage message="Disconnected. The saved key was deleted." />}
      {!ready && <p className="rounded-xl border border-brass bg-brass/10 p-4 text-sm">This feature is being switched on. Check back soon.</p>}
      {conn ? (
        <section className="card space-y-4 p-6">
          <p className="font-semibold text-ink">Connected to {ATS_LABEL[conn.provider as AtsProvider]}{conn.board ? ` · ${conn.board as string}` : ''} <span className="font-normal text-muted">· key ending {conn.key_hint as string}</span></p>
          {conn.last_error && <p className="rounded-lg bg-signal/10 px-3 py-2 text-sm text-signal">Last problem: {conn.last_error as string}</p>}
          <p className="text-sm text-muted">{sent} of the last {(recent ?? []).length} sends went through.</p>
          <div className="flex flex-wrap gap-2">
            <form action={setAutoSend.bind(null, !conn.auto_send)}><SubmitButton className="btn btn-outline" pendingText="…">{conn.auto_send ? 'Turn off automatic sending' : 'Send new applicants automatically'}</SubmitButton></form>
            <form action={disconnect}><SubmitButton className="btn btn-ghost border border-line text-signal" pendingText="…">Disconnect</SubmitButton></form>
          </div>
          <p className="text-xs text-muted">{conn.auto_send ? 'New applicants are sent as soon as they apply.' : 'Send applicants one at a time from each job’s applicant list.'}</p>
        </section>
      ) : company.isOwner && ready ? (
        <form action={saveConnection} className="card grid gap-4 p-6">
          <div><label htmlFor="ats-provider" className="field-label">Hiring system</label>
            <select id="ats-provider" name="provider" defaultValue={feed?.kind && ['greenhouse', 'lever', 'ashby'].includes(feed.kind as string) ? (feed.kind as string) : 'greenhouse'} className="field">
              <option value="greenhouse">Greenhouse</option><option value="lever">Lever</option><option value="ashby">Ashby</option>
            </select></div>
          <div><label htmlFor="ats-board" className="field-label">Greenhouse board token or Lever site name <span className="font-normal text-muted">(not needed for Ashby)</span></label>
            <input id="ats-board" name="board" defaultValue={(feed?.source as string) ?? ''} maxLength={80} className="field" /></div>
          <div><label htmlFor="ats-key" className="field-label">API key</label>
            <input id="ats-key" name="api_key" type="password" autoComplete="off" required maxLength={300} className="field" />
            <p className="mt-1 text-xs text-muted">Greenhouse: a Job Board API key. Lever: a postings API key from a Super Admin. Ashby: an API key with candidate write access. It’s encrypted before it’s saved.</p></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="auto_send" className="h-4 w-4 accent-navy" />Send new applicants automatically</label>
          <SubmitButton className="btn btn-primary" pendingText="Connecting…">Connect</SubmitButton>
        </form>
      ) : (
        <p className="card p-6 text-sm text-muted">{company.isOwner ? 'Connecting will be available here soon.' : 'Ask your company’s account owner to connect your hiring system.'}</p>
      )}
      <p className="text-xs text-muted">Applicants are told that employers may receive applications in their own hiring system. You’re responsible for how your hiring system stores and uses them.</p>
    </div>
  );
}
