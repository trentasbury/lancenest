import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PAID, getMyCompany } from '@/lib/employer';
import StatCard from '@/components/StatCard';
import Upsell from '@/components/employer/Upsell';

export const metadata: Metadata = { title: 'Hiring analytics' };

export default async function AnalyticsPage() {
  const { user } = await requireRole(['employer'], '/employer/analytics');
  const company = await getMyCompany(user.id);
  if (!company) redirect('/employer/dashboard');
  if (!PAID.includes(company.plan)) {
    return (
      <div className="container-page max-w-3xl py-12">
        <h1 className="mb-6 font-serif text-4xl font-medium">Hiring analytics</h1>
        <Upsell title="See what’s working." body="Views, applicants, and conversion for every job over the last 30 days — so you know which roles to boost and which to rewrite." />
      </div>
    );
  }
  const supabase = createClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const { data: jobs } = await supabase.from('jobs').select('id, title, status, featured_until').eq('company_id', company.id).order('posted_at', { ascending: false });
  const ids = (jobs ?? []).map((j) => j.id as string);
  const [{ data: views }, { data: apps }] = ids.length
    ? await Promise.all([
        supabase.from('job_views').select('job_id').in('job_id', ids).gte('viewed_on', since).limit(50000),
        supabase.from('applications').select('job_id, status, applied_at').in('job_id', ids).limit(50000),
      ])
    : [{ data: [] }, { data: [] }];
  const v = new Map<string, number>(); (views ?? []).forEach((r) => v.set(r.job_id as string, (v.get(r.job_id as string) ?? 0) + 1));
  const a = new Map<string, number>(); const a30 = new Map<string, number>(); const hired = new Map<string, number>();
  (apps ?? []).forEach((r) => {
    const id = r.job_id as string;
    a.set(id, (a.get(id) ?? 0) + 1);
    if ((r.applied_at as string).slice(0, 10) >= since) a30.set(id, (a30.get(id) ?? 0) + 1);
    if (r.status === 'offer') hired.set(id, (hired.get(id) ?? 0) + 1);
  });
  const totalViews = Array.from(v.values()).reduce((x, y) => x + y, 0);
  const totalApps30 = Array.from(a30.values()).reduce((x, y) => x + y, 0);
  const rate = (apps30: number, views30: number) => (views30 ? `${Math.round((apps30 / views30) * 100)}%` : '—');

  return (
    <div className="container-page py-10">
      <Link href="/employer/dashboard" className="text-sm text-muted hover:text-navy">← Employer dashboard</Link>
      <h1 className="mt-2 font-serif text-4xl font-medium">Hiring analytics</h1>
      <p className="mt-1 text-sm text-muted">Last 30 days · each member counts once per job per day</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Job views" value={totalViews} />
        <StatCard label="Applications" value={totalApps30} />
        <StatCard label="View → apply rate" value={rate(totalApps30, totalViews)} hint="Across all jobs" />
      </div>
      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-muted">
            <tr><th className="p-4">Job</th><th className="p-4">Views</th><th className="p-4">Applied (30d)</th><th className="p-4">Apply rate</th><th className="p-4">All-time applicants</th><th className="p-4">Offers</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(jobs ?? []).map((j) => (
              <tr key={j.id as string}>
                <td className="p-4">
                  <Link href={`/employer/jobs/${j.id}`} className="font-medium text-navy hover:underline">{j.title as string}</Link>
                  <span className="ml-2 text-xs capitalize text-muted">{j.status as string}{j.featured_until && new Date(j.featured_until as string) > new Date() ? ' · featured' : ''}</span>
                </td>
                <td className="p-4">{v.get(j.id as string) ?? 0}</td>
                <td className="p-4">{a30.get(j.id as string) ?? 0}</td>
                <td className="p-4">{rate(a30.get(j.id as string) ?? 0, v.get(j.id as string) ?? 0)}</td>
                <td className="p-4">{a.get(j.id as string) ?? 0}</td>
                <td className="p-4">{hired.get(j.id as string) ?? 0}</td>
              </tr>
            ))}
            {!ids.length && <tr><td colSpan={6} className="p-8 text-center text-muted">Post a job to start seeing analytics.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
