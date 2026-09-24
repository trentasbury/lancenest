import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import CreateCompanyForm from '@/components/employer/CreateCompanyForm';
import type { Company } from '@/lib/types';

export const metadata: Metadata = { title: 'Employer Dashboard' };

export default async function EmployerDashboard() {
  const { user, profile } = await requireRole(['employer'], '/employer/dashboard');
  const supabase = createClient();

  const { data: companyData } = await supabase.from('companies').select('*').eq('owner_id', user.id).maybeSingle();
  const company = companyData as Company | null;

  let activeJobs = 0;
  let totalJobs = 0;
  let applicants = 0;
  let interviews = 0;
  let jobs: { id: string; title: string; slug: string; status: string }[] = [];

  if (company) {
    const { data: jobRows } = await supabase
      .from('jobs')
      .select('id, title, slug, status')
      .eq('company_id', company.id)
      .order('posted_at', { ascending: false });
    jobs = jobRows ?? [];
    totalJobs = jobs.length;
    activeJobs = jobs.filter((j) => j.status === 'open').length;

    if (jobs.length) {
      const ids = jobs.map((j) => j.id);
      const [{ count: appCount }, { count: interviewCount }] = await Promise.all([
        supabase.from('applications').select('id', { count: 'exact', head: true }).in('job_id', ids).neq('status', 'withdrawn'),
        supabase.from('applications').select('id', { count: 'exact', head: true }).in('job_id', ids).eq('status', 'interview'),
      ]);
      applicants = appCount ?? 0;
      interviews = interviewCount ?? 0;
    }
  }

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page py-12">
          <p className="eyebrow text-brass">Employer Dashboard</p>
          <h1 className="mt-3 font-serif text-5xl font-medium text-ivory">{company?.name ?? `Welcome, ${profile.full_name.split(' ')[0]}.`}</h1>
          {company && (
            <p className="mt-2 text-cream/80">
              {company.plan.charAt(0).toUpperCase() + company.plan.slice(1)} plan
              {company.is_verified ? ' · Verified employer' : ' · Verification pending review'}
            </p>
          )}
        </div>
      </section>

      <div className="container-page space-y-10 py-10">
        {!company ? (
          <section className="max-w-3xl">
            <h2 className="font-serif text-3xl font-medium">Set up your company profile</h2>
            <p className="mt-2 text-muted">This becomes your public recruiting page. You can refine it anytime.</p>
            <div className="mt-6"><CreateCompanyForm /></div>
          </section>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Active jobs" value={activeJobs} hint={`${totalJobs} total`} />
              <StatCard label="Applicants" value={applicants} />
              <StatCard label="Interviews" value={interviews} />
              <StatCard label="Plan" value={company.plan === 'free' ? 'Free' : company.plan} />
            </div>

            <section>
              <div className="flex items-center justify-between">
                <h2 className="eyebrow">Your job postings</h2>
                <Link href={`/companies/${company.slug}`} className="text-sm text-navy underline decoration-brass underline-offset-4">View public company page →</Link>
              </div>
              <div className="mt-4">
                {jobs.length === 0 ? (
                  <EmptyState
                    title="No job postings yet."
                    body="The guided job-posting flow is the next piece being built. Your company page is live in the meantime."
                    action={{ href: `/companies/${company.slug}`, label: 'View company page' }}
                  />
                ) : (
                  <ul className="card divide-y divide-line">
                    {jobs.map((j) => (
                      <li key={j.id} className="flex items-center justify-between gap-4 p-4">
                        <Link href={`/jobs/${j.slug}`} className="font-medium text-navy hover:underline">{j.title}</Link>
                        <span className="pill capitalize">{j.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
