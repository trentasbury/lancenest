import type { Metadata } from 'next';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import SubmitButton from '@/components/SubmitButton';
import ShareMoment from '@/components/ShareMoment';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: 'My applications' };

const STATUS: Record<string, [string, string]> = {
  applied: ['Applied', 'text-navy'], viewed: ['Reviewed by employer', 'text-navy'], interview: ['Interview', 'text-olive'],
  offer: ['Offer', 'text-olive'], rejected: ['Not selected', 'text-muted'], withdrawn: ['Withdrawn', 'text-muted'],
};

async function withdraw(id: string) {
  'use server';
  const { user } = await requireRole(['veteran'], '/dashboard/applications');
  await (await createClient()).from('applications').update({ status: 'withdrawn' }).eq('id', id).eq('profile_id', user.id);
  revalidatePath('/dashboard/applications');
}

const APPROVAL: [string, string][] = [['not_started', 'Not started'], ['requested', 'Requested from my command'], ['approved', 'Approved'], ['denied', 'Denied']];

/** SkillBridge: the member tracks their command's approval. Written with the server key after checking ownership. */
async function setApproval(id: string, formData: FormData) {
  'use server';
  const { user } = await requireRole(['veteran'], '/dashboard/applications');
  const value = String(formData.get('approval') ?? '');
  if (!APPROVAL.some(([v]) => v === value)) return;
  await createAdminClient().from('applications').update({ command_approval: value }).eq('id', id).eq('profile_id', user.id);
  revalidatePath('/dashboard/applications');
}

type Row = { id: string; status: string; source: string; applied_at: string; updated_at: string; command_approval: string | null;
  job: { title: string; slug: string; employment_type: string; company: { name: string } | null } | null; resume: { file_name: string } | null };

export default async function ApplicationsPage() {
  const { user } = await requireRole(['veteran'], '/dashboard/applications');
  const { data } = await (await createClient()).from('applications')
    .select('id, status, source, applied_at, updated_at, command_approval, job:jobs(title, slug, employment_type, company:companies(name)), resume:resumes(file_name)')
    .eq('profile_id', user.id).order('applied_at', { ascending: false }).limit(200);
  // Company-site jobs the member said they didn't apply to aren't applications.
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => !(r.source === 'external' && r.status === 'withdrawn'));
  const active = rows.filter((r) => !['withdrawn', 'rejected'].includes(r.status));

  return (
    <div className="container-page max-w-4xl py-10">
      <Link href="/dashboard" className="text-sm text-muted hover:text-navy">← Dashboard</Link>
      <h1 className="mt-2 font-serif text-4xl font-medium">Jobs you applied to</h1>
      <p className="mt-1 text-muted">{active.length} active · {rows.length} total</p>
      {rows.some((r) => r.status === 'offer') && <div className="mt-6"><ShareMoment title="Congratulations on your offer." body="Tell your network you found your next role through LanceNest. Your post includes only a link to LanceNest." /></div>}
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
                {r.job?.employment_type === 'skillbridge' && r.source === 'lancenest' && !['withdrawn', 'rejected'].includes(r.status) && (
                  <form action={setApproval.bind(null, r.id)} className="flex items-center gap-2 text-xs">
                    <label htmlFor={`ap-${r.id}`} className="text-muted">Command approval</label>
                    <select id={`ap-${r.id}`} name="approval" defaultValue={r.command_approval ?? 'not_started'} className="field py-1 text-xs">{APPROVAL.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    <SubmitButton className="btn btn-ghost border border-line py-1 text-xs" pendingText="…">Save</SubmitButton>
                  </form>
                )}
                {['applied', 'viewed', 'interview'].includes(r.status) && (
                  <form action={withdraw.bind(null, r.id)} data-done={r.source === 'external' ? 'Removed from My applications.' : 'Application withdrawn. You can apply again from the job page.'}>
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
