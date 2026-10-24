import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import SubmitButton from '@/components/SubmitButton';
import { NEWSLETTER_SENDING } from '@/lib/newsletter';
import { removeSponsor, scheduleSponsor } from './actions';

export const metadata: Metadata = { title: 'Newsletter sponsors', robots: { index: false } };
const ERR: Record<string, string> = { date: 'Pick a Tuesday (issues go out Tuesdays).', text: 'Add a short headline and body, with no links or email addresses (the company page is linked for you).', company: 'Use the slug of a verified company.', taken: 'That issue already has a sponsor.' };

export default async function NewsletterSponsors(props: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const sp = await props.searchParams;
  await requireAdmin('/admin/newsletter');
  const admin = createAdminClient();
  const [{ count: readers }, { data: rows }] = await Promise.all([
    admin.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('newsletter_sponsors').select('id, issue_date, headline, company:companies(name)').gte('issue_date', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)).order('issue_date'),
  ]);
  return (
    <div className="container-page max-w-3xl py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-navy">← Admin</Link>
      <h1 className="mt-3 font-serif text-4xl font-medium">Newsletter sponsors</h1>
      <p className="mt-2 text-muted">{(readers ?? 0).toLocaleString()} confirmed readers.{(readers ?? 0) < 1000 ? ' Start selling a sponsor slot once the list passes about 1,000.' : ''}{!NEWSLETTER_SENDING ? ' The newsletter isn’t sending yet: add the business mailing address in Vercel.' : ''}</p>
      {sp.error && <p role="alert" className="mt-4 text-sm text-signal">{ERR[sp.error] ?? ERR.text}</p>}
      {sp.saved && <p className="mt-4 text-sm text-olive">Scheduled.</p>}
      <form action={scheduleSponsor} className="card mt-6 grid gap-3 p-5 sm:grid-cols-2">
        <div><label htmlFor="ns-date" className="field-label">Issue (a Tuesday)</label><input id="ns-date" name="issue_date" type="date" required className="field" /></div>
        <div><label htmlFor="ns-co" className="field-label">Company slug</label><input id="ns-co" name="company" required placeholder="harbor-logistics" className="field" /></div>
        <div className="sm:col-span-2"><label htmlFor="ns-h" className="field-label">Headline</label><input id="ns-h" name="headline" required maxLength={90} className="field" /></div>
        <div className="sm:col-span-2"><label htmlFor="ns-b" className="field-label">One or two sentences</label><textarea id="ns-b" name="body" required maxLength={300} rows={2} className="field" /></div>
        <div className="sm:col-span-2"><SubmitButton className="btn btn-primary" pendingText="Saving…">Schedule sponsor</SubmitButton></div>
      </form>
      <ul className="card mt-6 divide-y divide-line">
        {(rows ?? []).length === 0 && <li className="p-5 text-sm text-muted">Nothing scheduled.</li>}
        {((rows ?? []) as unknown as { id: string; issue_date: string; headline: string; company: { name: string } | null }[]).map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 p-4 text-sm">
            <span><strong>{r.issue_date}</strong> · {r.company?.name} · {r.headline}</span>
            <form action={removeSponsor.bind(null, r.id)}><SubmitButton className="btn btn-ghost py-1.5 text-xs text-signal" pendingText="…">Remove</SubmitButton></form>
          </li>
        ))}
      </ul>
    </div>
  );
}
