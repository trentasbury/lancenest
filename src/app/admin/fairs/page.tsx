import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import SubmitButton from '@/components/SubmitButton';
import { createFair } from '@/app/fairs/actions';

export const metadata: Metadata = { title: 'Career fairs', robots: { index: false } };

export default async function AdminFairsPage({ searchParams }: { searchParams: { created?: string; error?: string } }) {
  await requireAdmin('/admin/fairs');
  const admin = createAdminClient();
  const [{ data: fairs }, { data: booths }, { data: regs }] = await Promise.all([
    admin.from('career_fairs').select('id, slug, title, starts_at').order('starts_at', { ascending: false }).limit(50),
    admin.from('fair_booths').select('fair_id'), admin.from('fair_registrations').select('fair_id'),
  ]);
  const n = (rows: { fair_id: unknown }[] | null, id: string) => (rows ?? []).filter((r) => r.fair_id === id).length;
  return (
    <div className="container-page max-w-4xl space-y-6 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-navy">← Admin</Link>
      <h1 className="font-serif text-4xl font-medium">Career fairs</h1>
      {searchParams.created && <p className="text-sm text-olive">Fair scheduled. It’s now listed for members and employers.</p>}
      {searchParams.error && <p className="text-sm text-signal">Add a title and start time.</p>}
      <form action={createFair} className="card grid gap-3 p-6 sm:grid-cols-2">
        <input name="title" required placeholder="e.g. Fall 2026 Cleared Talent Fair" className="field sm:col-span-2" />
        <input name="starts_at" type="datetime-local" required className="field" />
        <input name="hours" type="number" min={1} max={12} defaultValue={4} className="field" aria-label="Length in hours" />
        <textarea name="description" rows={3} placeholder="Who should attend and which employers are coming" className="field sm:col-span-2" />
        <div className="sm:col-span-2"><SubmitButton className="btn btn-primary" pendingText="Scheduling…">Schedule fair</SubmitButton></div>
      </form>
      <ul className="card divide-y divide-line">
        {(fairs ?? []).length === 0 && <li className="p-5 text-sm text-muted">No fairs yet.</li>}
        {(fairs ?? []).map((f) => (
          <li key={f.id as string} className="flex justify-between gap-3 p-4 text-sm">
            <Link href={`/fairs/${f.slug}`} className="font-medium text-navy hover:underline">{f.title as string}</Link>
            <span className="text-muted">{new Date(f.starts_at as string).toLocaleDateString('en-US', { dateStyle: 'medium' })} · {n(booths, f.id as string)} booths · {n(regs, f.id as string)} registered</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
