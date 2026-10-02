import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getMyCompany, PAID } from '@/lib/employer';
import SubmitButton from '@/components/SubmitButton';
import VerifiedMark from '@/components/VerifiedMark';
import { startConversation } from '@/app/messages/actions';
import { reportHire, requestRerun } from './actions';

export const metadata: Metadata = { title: 'Verified Shortlists' };
const STATUS: Record<string, string> = { awaiting_payment: 'Awaiting payment', sourcing: 'We’re sourcing', delivered: 'Delivered', hired: 'Hired', closed: 'Closed' };
type Cand = { profile_id: string; note: string | null; profile: { full_name: string; username: string | null; headline: string | null; verified: boolean } | null };

export default async function ShortlistsPage({ searchParams }: { searchParams: { error?: string; hired?: string; rerun?: string; free?: string } }) {
  const { user } = await requireRole(['employer'], '/employer/shortlists');
  const company = await getMyCompany(user.id);
  if (!company) redirect('/employer/dashboard');
  const supabase = createClient();
  const { data: reqs } = await supabase.from('shortlist_requests').select('*').eq('company_id', company.id).neq('status', 'awaiting_payment').order('created_at', { ascending: false });
  const ids = (reqs ?? []).map((r) => r.id as string);
  const { data: cands } = ids.length ? await supabase.from('shortlist_candidates').select('request_id, profile_id, note, profile:profiles(full_name, username, headline, verified)').in('request_id', ids) : { data: [] };
  const qStart = new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1).getTime();
  const freeAvailable = ['federal', 'enterprise'].includes(company.plan) && !(reqs ?? []).some((r) => r.amount_cents === 0 && Date.parse(r.created_at as string) >= qStart);
  const price = PAID.includes(company.plan) ? 500 : 750;
  return (
    <div className="container-page max-w-4xl space-y-6 py-10">
      <Link href="/employer/dashboard" className="text-sm text-muted hover:text-navy">← Employer dashboard</Link>
      <div><h1 className="font-serif text-4xl font-medium">Verified Shortlists</h1>
        <p className="mt-1 text-muted">Tell us the role. Within 3 business days you get 3 verified service members who’ve confirmed they’re interested and available — hand-picked by our team.</p></div>
      {searchParams.error && <p className="text-sm text-signal">{searchParams.error === 'hire' ? 'Choose the person you hired and enter their first-year base salary.' : 'Please add a role title.'}</p>}
      {searchParams.hired && <p className="text-sm text-olive">Congratulations on the hire. We’ll send the placement invoice — and if it doesn’t work out within 90 days, we’ll find a replacement at no charge.</p>}
      {searchParams.rerun && <p className="text-sm text-olive">We’re on it — a fresh shortlist within 3 business days.</p>}
      {searchParams.free && <p className="text-sm text-olive">Your included Federal shortlist is in — candidates within 3 business days.</p>}

      <form action="/api/billing/checkout" method="post" className="card grid gap-3 p-6 sm:grid-cols-2">
        <input type="hidden" name="product" value="shortlist" />
        <p className="eyebrow sm:col-span-2">Request a shortlist · {freeAvailable ? 'Included with your plan this quarter' : `$${price}`}</p>
        <input name="role_title" required placeholder="Role (e.g. Cleared Network Engineer)" className="field sm:col-span-2" />
        <select name="engagement" className="field"><option value="full_time">Full-time hire</option><option value="contract_to_hire">Contract-to-hire</option><option value="contract">Contract / freelance</option></select>
        <select name="clearance_required" className="field"><option value="none">No clearance needed</option><option value="public_trust">Public Trust</option><option value="secret">Secret</option><option value="top_secret">Top Secret</option><option value="ts_sci">TS/SCI</option></select>
        <input name="location" placeholder="Location (or Remote)" className="field" />
        <input name="pay" placeholder="Pay range (e.g. $95–115K or $70/hr)" className="field" />
        <textarea name="details" rows={3} placeholder="Must-haves, certifications, start date" className="field sm:col-span-2" />
        <div className="sm:col-span-2"><button className="btn btn-primary" disabled={!company.is_verified}>{freeAvailable ? 'Request my included shortlist' : `Request and pay $${price}`}</button>
          <p className="mt-2 text-xs text-muted">Free re-run if none fit. Only if you hire from a shortlist: 10% of first-year base salary (agencies typically charge 15–25%), with any shortlist fee credited and a 90-day replacement guarantee. Hires from your own job posts and searches never carry a fee. Contract hires: standard Protected Payments fees. Clearances are self-reported — you confirm eligibility.</p></div>
      </form>

      {(reqs ?? []).map((r) => {
        const list = ((cands ?? []) as unknown as (Cand & { request_id: string })[]).filter((c) => c.request_id === r.id);
        return (
          <section key={r.id as string} className="card space-y-3 p-6">
            <div className="flex flex-wrap justify-between gap-2"><p className="font-serif text-2xl text-navy">{r.role_title as string}</p><span className="text-sm text-muted">{STATUS[r.status as string]}{r.status === 'sourcing' && r.due_at ? ` · due ${new Date(r.due_at as string).toLocaleDateString('en-US', { dateStyle: 'medium' })}` : ''}</span></div>
            {list.length > 0 && (
              <ul className="divide-y divide-line">
                {list.map((c) => (
                  <li key={c.profile_id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0"><p className="font-medium">{c.profile?.username ? <Link href={`/veterans/${c.profile.username}`} className="hover:underline">{c.profile.full_name}</Link> : c.profile?.full_name}{c.profile?.verified && <VerifiedMark />}</p>
                      <p className="text-xs text-muted">{c.profile?.headline}</p>{c.note && <p className="mt-1 text-sm text-ink/80">{c.note}</p>}</div>
                    <form action={startConversation.bind(null, c.profile_id)}><SubmitButton className="btn btn-outline py-1.5 text-xs" pendingText="…">Message</SubmitButton></form>
                  </li>
                ))}
              </ul>
            )}
            {r.status === 'delivered' && (
              <div className="flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-end">
                <form action={reportHire.bind(null, r.id as string)} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
                  <select name="profile_id" required className="field text-sm"><option value="">Who did you hire?</option>{list.map((c) => <option key={c.profile_id} value={c.profile_id}>{c.profile?.full_name}</option>)}</select>
                  <input name="salary" required inputMode="decimal" placeholder="First-year base salary ($)" className="field text-sm" />
                  <SubmitButton className="btn btn-primary shrink-0 text-sm" pendingText="…">We hired</SubmitButton>
                </form>
                {!r.rerun_used && <form action={requestRerun.bind(null, r.id as string)}><button className="btn btn-ghost border border-line text-sm">None fit — free re-run</button></form>}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
