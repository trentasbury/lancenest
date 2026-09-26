import type { Metadata } from 'next';
import Link from 'next/link';
import CompanyVerification from '@/components/employer/CompanyVerification';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import CreateCompanyForm from '@/components/employer/CreateCompanyForm';
import type { Company } from '@/lib/types';

export const metadata: Metadata = { title: 'Employer Dashboard' };

const PLAN_LABEL: Record<string, string> = { free: 'Free', professional: 'Professional', federal: 'Federal', enterprise: 'Enterprise' };

export default async function EmployerDashboard({ searchParams }: { searchParams: { error?: string; verify?: string } }) {
  const { user, profile } = await requireRole(['employer'], '/employer/dashboard');
  const supabase = createClient();

  const { data: companyData } = await supabase.from('companies').select('*').eq('owner_id', user.id).maybeSingle();
  const company = companyData as (Company & { stripe_customer_id: string | null; contact_credits: number }) | null;

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
              <StatCard label="Plan" value={PLAN_LABEL[company.plan] ?? company.plan} hint={company.plan === 'free' ? `${activeJobs} of ${2 + (company.extra_job_slots ?? 0)} open posts used` : 'Unlimited job posts'} />
            </div>

            {searchParams.error && <p role="alert" className="text-sm text-signal">That purchase couldn’t start. Please try again.</p>}

            {searchParams.verify === 'submitted' && <p className="text-sm text-olive">Thanks — your company is in review.</p>}
            <CompanyVerification status={(company as unknown as { verification_status: string }).verification_status} note={(company as unknown as { verification_note: string | null }).verification_note} flash={searchParams.verify} />
            {searchParams.error === 'verify' && <p role="alert" className="text-sm text-signal">Your company needs to be verified before you can purchase a plan or add-on.</p>}

            <nav className="grid gap-3 sm:grid-cols-3">
              <Link href="/employer/candidates" className="card p-5 hover:border-brass"><p className="eyebrow">Candidate search</p><p className="mt-2 font-serif text-xl text-navy">Find veterans →</p></Link>
              <Link href="/employer/analytics" className="card p-5 hover:border-brass"><p className="eyebrow">Hiring analytics</p><p className="mt-2 font-serif text-xl text-navy">Views & applicants →</p></Link>
              <div className="card p-5">
                <p className="eyebrow">Contact credits</p>
                <p className="mt-2 font-serif text-xl text-navy">{company.contact_credits ?? 0} available</p>
                <form action="/api/billing/checkout" method="post" className="mt-2"><input type="hidden" name="product" value="contact_pack" /><button className="text-sm text-navy underline decoration-brass underline-offset-4">Buy 5 · $59</button></form>
              </div>
            </nav>

            <section className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="eyebrow">Your plan: {PLAN_LABEL[company.plan] ?? company.plan}</p>
                <p className="mt-1 text-sm text-muted">
                  {company.plan === 'free'
                    ? 'Upgrade for unlimited posts, candidate search, and analytics — or add single job slots as you need them.'
                    : 'Thank you for hiring veterans. Manage your card, invoices, and plan anytime.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {company.plan === 'free' && (
                  <>
                    <form action="/api/billing/checkout" method="post"><input type="hidden" name="product" value="employer_professional_month" /><button className="btn btn-primary">Professional · $199/mo (Founding $149)</button></form>
                    <form action="/api/billing/checkout" method="post"><input type="hidden" name="product" value="job_slot" /><button className="btn btn-outline">+1 job slot · $39/mo</button></form>
                  </>
                )}
                {company.plan === 'professional' && (
                  <form action="/api/billing/checkout" method="post"><input type="hidden" name="product" value="employer_federal_month" /><button className="btn btn-primary">Upgrade to Federal · $499/mo</button></form>
                )}
                <Link href="/settings/account" className="btn btn-ghost border border-line">Account</Link>
                {company.stripe_customer_id && (
                  <form action="/api/billing/portal" method="post"><button className="btn btn-ghost border border-line">Manage billing</button></form>
                )}
              </div>
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="eyebrow">Your job postings</h2>
                <Link href="/employer/jobs/new" className="btn btn-primary">Post a job</Link>
                <Link href={`/companies/${company.slug}`} className="text-sm text-navy underline decoration-brass underline-offset-4">View public company page →</Link>
              </div>
              <div className="mt-4">
                {jobs.length === 0 ? (
                  <EmptyState
                    title="No job postings yet."
                    body="Post your first role — veterans on LanceNest see it right away."
                    action={{ href: '/employer/jobs/new', label: 'Post a job' }}
                  />
                ) : (
                  <ul className="card divide-y divide-line">
                    {jobs.map((j) => (
                      <li key={j.id} className="flex items-center justify-between gap-4 p-4">
                        <Link href={`/employer/jobs/${j.id}`} className="font-medium text-navy hover:underline">{j.title}</Link>
                        <Link href={`/employer/jobs/${j.id}/applicants`} className="ml-3 text-xs text-muted underline">Applicants</Link>
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
