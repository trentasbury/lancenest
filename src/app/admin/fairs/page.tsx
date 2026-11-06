import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import SubmitButton from '@/components/SubmitButton';
import { createFair } from '@/app/fairs/actions';
import { BASES } from '@/lib/bases';
import { US_STATES } from '@/lib/states';
import { FAIR_FORMATS, FAIR_TIMEZONES, fairPlace, fairWhen, formatLabel } from '@/lib/fairs';

export const metadata: Metadata = { title: 'Career fairs', robots: { index: false } };

export default async function AdminFairsPage(props: { searchParams: Promise<{ created?: string; error?: string }> }) {
  const searchParams = await props.searchParams;
  await requireAdmin('/admin/fairs');
  const admin = createAdminClient();
  const [{ data: fairs }, { data: booths }, { data: regs }] = await Promise.all([
    admin.from('career_fairs').select('id, slug, title, starts_at, format, venue_name, city, state, timezone, capacity').order('starts_at', { ascending: false }).limit(50),
    admin.from('fair_booths').select('fair_id'), admin.from('fair_registrations').select('fair_id'),
  ]);
  const n = (rows: { fair_id: unknown }[] | null, id: string) => (rows ?? []).filter((r) => r.fair_id === id).length;
  return (
    <div className="container-page max-w-4xl space-y-6 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-navy">← Admin</Link>
      <h1 className="font-serif text-4xl font-medium">Career fairs</h1>
      {searchParams.created && <p className="text-sm text-olive">Fair scheduled. It’s now listed for members and employers.</p>}
      {searchParams.error && <p className="text-sm text-signal">{searchParams.error === 'place' ? 'In-person fairs need a city and state.' : searchParams.error === 'slug' ? 'A fair with that title already exists that month. Change the title.' : 'Add a title and start time.'}</p>}
      <form action={createFair} className="card grid gap-3 p-6 sm:grid-cols-2">
        <input name="title" required placeholder="e.g. Fort Bragg Hiring Pop-Up, or Fall 2026 Cleared Talent Fair" className="field sm:col-span-2" />
        <label className="text-sm"><span className="field-label">Format</span>
          <select name="format" defaultValue="virtual" className="field">{FAIR_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
        </label>
        <label className="text-sm"><span className="field-label">Time zone</span>
          <select name="timezone" defaultValue="America/New_York" className="field">{FAIR_TIMEZONES.map(([z, l]) => <option key={z} value={z}>{l}</option>)}</select>
        </label>
        <label className="text-sm"><span className="field-label">Starts (local time)</span><input name="starts_at" type="datetime-local" required className="field" /></label>
        <label className="text-sm"><span className="field-label">Length (hours)</span><input name="hours" type="number" min={1} max={12} defaultValue={4} className="field" /></label>
        <fieldset className="grid gap-3 rounded-lg border border-line p-4 sm:col-span-2 sm:grid-cols-2">
          <legend className="px-1 text-xs text-muted">In person only (leave blank for virtual)</legend>
          <input name="venue_name" maxLength={140} placeholder="Venue (e.g. Fayetteville Regional Airport Conference Center)" className="field sm:col-span-2" />
          <input name="address" maxLength={240} placeholder="Street address (shown to verified members)" className="field sm:col-span-2" />
          <input name="city" maxLength={80} placeholder="City" className="field" />
          <select name="state" defaultValue="" className="field"><option value="">State</option>{US_STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
          <input name="capacity" type="number" min={1} max={100000} placeholder="Capacity (optional)" className="field" />
          <select name="base_slug" defaultValue="" className="field">
            <option value="">Nearby base (optional)</option>
            {[...BASES].sort((a, b) => a.name.localeCompare(b.name)).map((b) => <option key={b.slug} value={b.slug}>{b.name} ({b.city})</option>)}
          </select>
        </fieldset>
        <textarea name="description" rows={3} placeholder="Who should attend, which employers are coming, and for on-base events, how civilians get access (ID and visitor pass)" className="field sm:col-span-2" />
        <div className="sm:col-span-2"><SubmitButton className="btn btn-primary" pendingText="Scheduling…">Schedule fair</SubmitButton></div>
      </form>
      <ul className="card divide-y divide-line">
        {(fairs ?? []).length === 0 && <li className="p-5 text-sm text-muted">No fairs yet.</li>}
        {(fairs ?? []).map((f) => (
          <li key={f.id as string} className="flex justify-between gap-3 p-4 text-sm">
            <Link href={`/fairs/${f.slug}`} className="font-medium text-navy hover:underline">{f.title as string}</Link>
            <span className="text-right text-muted">{fairWhen(f.starts_at as string, f.timezone as string, 'medium')} · {formatLabel(f.format as string)}{f.format !== 'virtual' ? ` · ${fairPlace(f as never)}` : ''}<span className="block">{n(booths, f.id as string)} booths · {n(regs, f.id as string)}{f.capacity ? ` of ${f.capacity}` : ''} registered</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
