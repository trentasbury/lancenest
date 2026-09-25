import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import JobForm from '@/components/employer/JobForm';
import JobErrors from '@/components/employer/JobErrors';
import { saveJob } from '../actions';

export const metadata: Metadata = { title: 'Post a job' };

export default async function NewJobPage({ searchParams }: { searchParams: { error?: string } }) {
  const { user } = await requireRole(['employer'], '/employer/jobs/new');
  const { data: company } = await createClient().from('companies').select('id').eq('owner_id', user.id).maybeSingle();
  if (!company) redirect('/employer/dashboard');
  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <Link href="/employer/dashboard" className="text-sm text-muted hover:text-navy">← Employer dashboard</Link>
      <h1 className="font-serif text-4xl font-medium">Post a job</h1>
      <JobErrors error={searchParams.error} />
      <JobForm action={saveJob.bind(null, null)} />
    </div>
  );
}
