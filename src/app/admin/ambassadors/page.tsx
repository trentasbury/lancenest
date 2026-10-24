import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import SubmitButton from '@/components/SubmitButton';
import { decideAmbassador } from '@/app/ambassadors/actions';

export const metadata: Metadata = { title: 'Ambassadors', robots: { index: false } };

export default async function AdminAmbassadors() {
  await requireAdmin('/admin/ambassadors');
  const { data } = await createAdminClient().from('ambassadors').select('profile_id, status, installation, role_note, applied_at, profile:profiles!ambassadors_profile_id_fkey(full_name, username)').order('applied_at', { ascending: false }).limit(200);
  const rows = (data ?? []) as unknown as { profile_id: string; status: string; installation: string; role_note: string | null; applied_at: string; profile: { full_name: string; username: string | null } | null }[];
  return (
    <div className="container-page max-w-4xl py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-navy">← Admin</Link>
      <h1 className="mt-3 font-serif text-4xl font-medium">Ambassadors</h1>
      <ul className="card mt-6 divide-y divide-line">
        {rows.length === 0 && <li className="p-5 text-sm text-muted">No applications yet.</li>}
        {rows.map((r) => (
          <li key={r.profile_id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
            <div>
              <p className="font-medium">{r.profile?.username ? <Link href={`/veterans/${r.profile.username}`} className="text-navy underline">{r.profile.full_name}</Link> : r.profile?.full_name} <span className="text-muted">· {r.installation} · {r.status}</span></p>
              {r.role_note && <p className="text-xs text-muted">{r.role_note}</p>}
            </div>
            <div className="flex gap-2">
              {r.status !== 'active' && <form action={decideAmbassador.bind(null, r.profile_id, 'active')}><SubmitButton className="btn btn-primary py-1.5 text-xs" pendingText="…">Approve</SubmitButton></form>}
              {r.status !== 'removed' && <form action={decideAmbassador.bind(null, r.profile_id, 'removed')}><SubmitButton className="btn btn-outline py-1.5 text-xs" pendingText="…">{r.status === 'active' ? 'Remove' : 'Decline'}</SubmitButton></form>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
