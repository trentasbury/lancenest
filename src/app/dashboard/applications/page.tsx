import type { Metadata } from 'next';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import SubmitButton from '@/components/SubmitButton';

export const metadata: Metadata = { title: 'My applications' };

const STATUS: Record<string, [string, string]> = {
  applied: ['Applied', 'text-navy'], viewed: ['Reviewed by employer', 'text-navy'], interview: ['Interview', 'text-olive'],
  offer: ['Offer', 'text-olive'], rejected: ['Not selected', 'text-muted'], withdrawn: ['Withdrawn', 'text-muted'],
};

async function withdraw(id: string) {
  'use server';
  const { user } = await requireRole(['veteran'], '/dashboard/applications');
  await createClient().from('applications').update({ status: 'withdrawn' }).eq('id', id).eq('profile_id', user.id);
  revalidatePath('/dashboard/applications');
}

type Row = { id: string; status: string; source: string; applied_at: string; updated_at: string;
  job: { title: string; slug: string; company: { name: string } | null } | null; resume: { file_name: string } | null };

export default async function ApplicationsPage() {
  const { user } = await requireRole(['veteran'], '/dashboard/applications');
  const { data } = await createClient().from('applications')
    .select('id, status, source, applied_at, updated_at, job:jobs(title, slug, company:companies(name)), resume:resumes(file_name)')
    .eq('profile_id', user.id).order('applied_at', { ascending: false }).limit(200);
  const rows = (data ?? []) as unknown as Row[];
  const active = rows.filter((r) => !['withdrawn', 'rejected'].includes(r.status));

  return (
    <div className="container-page max-w-4xl py-10">
      <Link href="/dashboard" className="text-sm text-muted hover:text-navy">← Dashboard</Link>
      <h1 className="mt-2 font-serif text-4xl font-medium">Jobs you applied to</h1>
      <p className="mt-1 text-muted">{active.length} active · {rows.length} total</p>
      {rows.length === 0 ? (
        <div className="card mt-6 p-8 text-center"><p className="text-muted">You haven’t applied to anything yet.</p><Link href="/jobs" className="btn btn-primary mt-4">Find jobs</Link></div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => {
            const [label, tone] = r.source === 'external' && r.status === 'applied' ? ['Applied on company site', 'text-navy'] : STATUS[r.status] ?? [r.status, 'text-muted'];
            return (
              <li key={r.id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  {r.job ? <Link href={`/jobs/${r.job.slug}`} className="font-serif text-xl text-navy hover:underline">{r.job.title}</Link> : <span className="font-serif text-xl">Job no longer listed</span>}
                  <p className="text-sm text-muted">{r.job?.company?.name} · applied {new Date(r.applied_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}{r.resume ? ` · sent ${r.resume.file_name}` : ''}</p>
                </div>
                <p className={`text-sm font-semibold ${tone}`}>{label}</p>
                {['applied', 'viewed', 'interview'].includes(r.status) && (
                  <form action={withdraw.bind(null, r.id)}>
                    <SubmitButton className="btn btn-ghost py-1.5 text-xs" pendingText="…">{r.source === 'external' ? 'Didn’t apply? Remove' : 'Withdraw'}</SubmitButton>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
