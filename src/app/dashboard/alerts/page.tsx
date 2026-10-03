import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { US_STATES } from '@/lib/states';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { createAlert, deleteAlert } from './actions';

export const metadata: Metadata = { title: 'Job alerts' };
const CAP: Record<string, number> = { pro: 3, pro_plus: 10, federal_pro: 10 };

export default async function AlertsPage({ searchParams }: { searchParams: { error?: string; saved?: string } }) {
  const { user } = await requireRole(['veteran'], '/dashboard/alerts');
  const supabase = createClient();
  const [{ data: vet }, { data: alerts }] = await Promise.all([
    supabase.from('veteran_profiles').select('plan').eq('profile_id', user.id).maybeSingle(),
    supabase.from('job_alerts').select('id, keywords, state, arrangement, cleared_only').eq('profile_id', user.id).order('created_at'),
  ]);
  const plan = (vet?.plan as string) ?? 'free';
  const cap = CAP[plan] ?? 0;
  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <Link href="/dashboard" className="text-sm text-muted hover:text-navy">← Dashboard</Link>
      <h1 className="font-serif text-4xl font-medium">Job alerts</h1>
      <p className="text-muted">Get a daily email when new jobs match. {['pro_plus', 'federal_pro'].includes(plan) ? 'Your cleared-job alerts include roles during your 48-hour early-access window.' : ''}</p>
      {cap === 0 ? (
        <div className="card p-6"><p className="font-medium">Job alerts are part of Pro.</p><p className="mt-1 text-sm text-muted">Pro includes 3 alerts, Pro Plus 5, and Federal 10 plus cleared-job alerts.</p><Link href="/plans" className="btn btn-primary mt-4">See plans</Link></div>
      ) : (
        <>
          {searchParams.error && <FormMessage error={searchParams.error === 'limit' ? `You’ve used all ${cap} alerts on your plan.` : 'Job alerts are part of paid plans.'} />}
          {searchParams.saved && <FormMessage message="Alert saved. You’ll get an email when new matching jobs are posted." />}
          <ul className="card divide-y divide-line">
            {(alerts ?? []).length === 0 && <li className="p-5 text-sm text-muted">No alerts yet.</li>}
            {(alerts ?? []).map((a) => (
              <li key={a.id as string} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span>{[a.keywords && `“${a.keywords}”`, a.state, a.arrangement, a.cleared_only && 'cleared jobs only'].filter(Boolean).join(' · ') || 'All new jobs'}</span>
                <form action={deleteAlert.bind(null, a.id as string)}><button className="text-xs text-muted hover:text-signal">Delete</button></form>
              </li>
            ))}
          </ul>
          {(alerts ?? []).length < cap && (
            <form action={createAlert} className="card grid gap-3 p-5 sm:grid-cols-2">
              <input name="keywords" placeholder="Keywords (e.g. cybersecurity, logistics)" className="field sm:col-span-2" />
              <select name="state" className="field"><option value="">Any state</option>{US_STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
              <select name="arrangement" className="field"><option value="">Any arrangement</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select>
              {['pro_plus', 'federal_pro'].includes(plan) && <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="cleared_only" className="accent-navy" />Only jobs that require a security clearance</label>}
              <div className="sm:col-span-2"><SubmitButton className="btn btn-primary" pendingText="Saving…">Create alert</SubmitButton></div>
            </form>
          )}
          <p className="text-xs text-muted">{(alerts ?? []).length} of {cap} alerts used.</p>
        </>
      )}
    </div>
  );
}
