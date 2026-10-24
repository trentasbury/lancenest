import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { FEED_SYNC, getMyCompany } from '@/lib/employer';
import { createAdminClient } from '@/lib/supabase/admin';
import ImportForm from './ImportForm';

export const metadata: Metadata = { title: 'Import jobs', robots: { index: false } };

export default async function ImportJobsPage() {
  const { user } = await requireRole(['employer'], '/employer/jobs/import');
  const company = await getMyCompany(user.id);
  if (!company) redirect('/employer/dashboard');
  const { data: feed } = await createAdminClient().from('job_feeds').select('kind, source, auto_sync, last_synced_at').eq('company_id', company.id).maybeSingle();
  return (
    <div className="container-page max-w-3xl py-10">
      <Link href="/employer/dashboard" className="text-sm text-muted hover:text-navy">← Employer dashboard</Link>
      <h1 className="mt-3 font-serif text-4xl font-medium">Import your jobs</h1>
      <p className="mt-2 text-muted">Bring your open jobs in from your hiring system instead of retyping them. Works with Greenhouse, Lever, Ashby, and any standard XML job feed.</p>
      {!company.is_verified && <p className="card mt-6 border-brass p-4 text-sm">Your company needs to be verified before you can import jobs. <Link href="/employer/dashboard" className="text-navy underline">Finish verification</Link></p>}
      {feed?.last_synced_at && <p className="mt-4 text-xs text-muted">Last imported {new Date(feed.last_synced_at as string).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}{feed.auto_sync ? ' · syncing daily' : ''}.</p>}
      <div className="mt-6"><ImportForm paid={FEED_SYNC.includes(company.plan)} defaults={feed ? { kind: feed.kind as string, source: feed.source as string, autoSync: !!feed.auto_sync } : null} /></div>
    </div>
  );
}
