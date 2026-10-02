import type { Metadata } from 'next';
import Link from 'next/link';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { OPEN_CATEGORIES } from '@/lib/freelance';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { deleteService, saveService, setServiceStatus } from '../actions';

export const metadata: Metadata = { title: 'My services' };
const ERR: Record<string, string> = { ack: 'Please confirm both acknowledgments.', required: 'Add a title, a description of at least 20 characters, and a price of at least $20.', scam: 'That listing contains wording we don’t allow.', save: 'That didn’t save — please try again.' };

export default async function MyServicesPage({ searchParams }: { searchParams: { error?: string; saved?: string } }) {
  const { user } = await requireVerifiedMember('/freelance/services/mine');
  const supabase = createClient();
  const [{ data: services }, { data: fp }] = await Promise.all([
    supabase.from('service_listings').select('id, title, price_cents, price_type, status').eq('profile_id', user.id).order('created_at', { ascending: false }),
    supabase.from('freelancer_profiles').select('payouts_enabled').eq('profile_id', user.id).maybeSingle(),
  ]);
  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <Link href="/freelance/services" className="text-sm text-muted hover:text-navy">← Services</Link>
      <h1 className="font-serif text-4xl font-medium">My services</h1>
      <p className="text-muted">List what you can do — anyone on LanceNest can hire you and pay through the site. Services also appear on your profile.</p>
      {!fp?.payouts_enabled && <p className="rounded-[4px] border border-brass bg-brass/10 p-4 text-sm">Before anyone can hire you, <Link href="/freelance/profile" className="font-medium text-navy underline">set up payouts</Link> (about 5 minutes with Stripe).</p>}
      {searchParams.error && <FormMessage error={ERR[searchParams.error] ?? ERR.save} />}
      {searchParams.saved && <FormMessage message="Service listed." />}
      <ul className="card divide-y divide-line">
        {(services ?? []).length === 0 && <li className="p-5 text-sm text-muted">No services yet.</li>}
        {(services ?? []).map((s) => (
          <li key={s.id as string} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><Link href={`/freelance/services/${s.id}`} className="font-medium text-navy hover:underline">{s.title as string}</Link><p className="text-xs text-muted">${((s.price_cents as number) / 100).toLocaleString()} · {s.status === 'active' ? 'Active' : 'Paused'}</p></div>
            <div className="flex gap-2">
              <form action={setServiceStatus.bind(null, s.id as string, s.status === 'active' ? 'paused' : 'active')}><SubmitButton className="btn btn-outline py-1.5 text-xs" pendingText="…">{s.status === 'active' ? 'Pause' : 'Activate'}</SubmitButton></form>
              <form action={deleteService.bind(null, s.id as string)}><button className="btn btn-ghost py-1.5 text-xs text-signal">Delete</button></form>
            </div>
          </li>
        ))}
      </ul>
      <form action={saveService} className="card grid gap-3 p-6 sm:grid-cols-2">
        <p className="font-medium sm:col-span-2">Add a service</p>
        <input name="title" required maxLength={100} placeholder="e.g. Mobile auto repair — brakes, oil, diagnostics" className="field sm:col-span-2" />
        <select name="category" className="field">{OPEN_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <select name="delivery" className="field"><option value="on_site">On-site</option><option value="remote">Remote</option><option value="both">On-site or remote</option></select>
        <input name="price" required inputMode="decimal" placeholder="Price ($)" className="field" />
        <select name="price_type" className="field"><option value="fixed">Fixed price</option><option value="starting_at">Starting at</option><option value="hourly">Per hour</option></select>
        <input name="service_area" maxLength={120} placeholder="Service area (e.g. Clermont, FL — 25 miles)" className="field sm:col-span-2" />
        <textarea name="description" required rows={4} maxLength={3000} placeholder="What’s included, your experience, tools, and turnaround" className="field sm:col-span-2" />
        <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" name="license_ack" required className="mt-1 accent-navy" />I hold any license, certification, or insurance this work legally requires where I perform it.</label>
        <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" name="duty_ack" required className="mt-1 accent-navy" />If I’m currently serving, I have my command’s approval for off-duty employment where required, and I won’t use government time, equipment, or my rank or uniform to promote this work.</label>
        <div className="sm:col-span-2"><SubmitButton className="btn btn-primary" pendingText="Saving…">List service</SubmitButton></div>
      </form>
    </div>
  );
}
