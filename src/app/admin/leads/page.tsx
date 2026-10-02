import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: 'Call requests', robots: { index: false } };

export default async function LeadsPage() {
  await requireAdmin('/admin/leads');
  const { data: conv } = await createAdminClient().from('conversion_requests').select('id, fee_cents, salary_cents, status, created_at, contract:contracts(title)').order('created_at', { ascending: false }).limit(50);
  const { data } = await createAdminClient().from('sales_leads').select('*').order('created_at', { ascending: false }).limit(100);
  return (
    <div className="container-page max-w-4xl space-y-6 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-navy">← Admin</Link>
      <h1 className="font-serif text-4xl font-medium">Call requests</h1>
      {(conv ?? []).length > 0 && (
        <section className="card p-5 text-sm"><p className="eyebrow">Contract-to-hire conversions</p>
          <ul className="mt-2 divide-y divide-line">{((conv ?? []) as unknown as { id: string; fee_cents: number; salary_cents: number; created_at: string; contract: { title: string } | null }[]).map((c) => <li key={c.id} className="flex justify-between py-2"><span>{c.contract?.title} · salary ${(c.salary_cents / 100).toLocaleString()}</span><strong>{c.fee_cents ? `Invoice $${(c.fee_cents / 100).toLocaleString()}` : 'No fee'}</strong></li>)}</ul>
        </section>
      )}
      {(data ?? []).length === 0 && <p className="card p-8 text-center text-muted">No call requests yet.</p>}
      {(data ?? []).map((l) => (
        <div key={l.id as string} className="card space-y-1 p-5 text-sm">
          <div className="flex flex-wrap justify-between gap-2"><p className="font-serif text-xl text-navy">{l.company as string} · {(l.plan as string) ?? '—'}</p><span className="text-xs text-muted">{new Date(l.created_at as string).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
          <p>{l.name as string} · <a href={`mailto:${l.email}?subject=LanceNest%20%E2%80%94%20your%20call%20request`} className="text-navy underline">{l.email as string}</a> · {(l.size as string) ?? ''}</p>
          {l.needs && <p className="text-ink/80">{l.needs as string}</p>}
          {l.times && <p className="text-muted">Good times: {l.times as string}</p>}
        </div>
      ))}
    </div>
  );
}
