import type { Metadata } from 'next';
import { getMyCompany } from '@/lib/employer';
import Link from 'next/link';
import CompanyVerification from '@/components/employer/CompanyVerification';
import { requestPublicSafety, requestSkillBridge } from '@/app/employer/actions';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import CreateCompanyForm from '@/components/employer/CreateCompanyForm';
import type { Company } from '@/lib/types';

export const metadata: Metadata = { title: 'Employer Dashboard' };

const PLAN_LABEL: Record<string, string> = { free: 'Free', professional: 'Professional', federal: 'Federal', enterprise: 'Enterprise' };

export default async function EmployerDashboard({ searchParams }: { searchParams: { error?: string; verify?: string; skillbridge?: string; ps?: string } }) {
  const { user, profile } = await requireRole(['employer'], '/employer/dashboard');
  const supabase = createClient();

  const companyData = await getMyCompany(user.id);
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
            {searchParams.verify === 'auto' && <p className="text-sm font-medium text-olive">✓ Your company is verified — your work email matches your website. You can publish jobs now.</p>}
            {!(company as unknown as { isOwner: boolean }).isOwner && <p className="rounded-[4px] border border-line bg-paper p-4 text-sm">You’re on <strong>{company.name}</strong>’s hiring team. Billing, verification, and the company page are managed by the account owner.</p>}
            {(company as unknown as { isOwner: boolean }).isOwner && <CompanyVerification status={(company as unknown as { verification_status: string }).verification_status} note={(company as unknown as { verification_note: string | null }).verification_note} flash={searchParams.verify} />}
            {searchParams.error === 'verify' && <p role="alert" className="text-sm text-signal">Your company needs to be verified before you can purchase a plan or add-on.</p>}

            {(company as unknown as { is_verified: boolean; isOwner: boolean }).is_verified && (company as unknown as { isOwner: boolean }).isOwner && (() => {
              const sbs = (company as unknown as { skillbridge_status: string; skillbridge_note: string | null }).skillbridge_status;
              return (
                <section className="card p-6">
                  <p className="eyebrow">DoD SkillBridge</p>
                  {sbs === 'authorized' ? <p className="mt-2 text-sm text-olive">✓ Confirmed DoD SkillBridge organization. Post programs by choosing “SkillBridge” as the employment type.</p>
                  : sbs === 'pending' || searchParams.skillbridge === 'requested' ? <p className="mt-2 text-sm text-muted">We’re confirming your organization on the official DoD SkillBridge list — usually within one business day.</p>
                  : (
                    <form action={requestSkillBridge} className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <label htmlFor="org_name" className="field-label">Your organization’s name exactly as listed on skillbridge.osd.mil</label>
                        <input id="org_name" name="org_name" required className="field" />
                        <p className="mt-1 text-xs text-muted">{sbs === 'rejected' ? 'We couldn’t find you on the official list last time. ' : ''}Only DoD-authorized organizations can list SkillBridge programs. Not authorized yet? You can still hire transitioning members for roles that start after they separate.</p>
                      </div>
                      <button className="btn btn-outline shrink-0">Request SkillBridge listing access</button>
                    </form>
                  )}
                </section>
              );
            })()}

            {(company as unknown as { is_verified: boolean; isOwner: boolean }).is_verified && (company as unknown as { isOwner: boolean }).isOwner && (() => {
              const ps = (company as unknown as { public_safety_status: string }).public_safety_status;
              if (ps === 'approved') return <p className="rounded-[4px] border border-olive/40 bg-olive/5 p-4 text-sm text-olive">✓ Public Safety rate active — 30% off Professional and Federal, applied automatically at checkout.</p>;
              if (ps === 'pending' || searchParams.ps === 'requested') return <p className="text-sm text-muted">Public Safety rate requested — we’ll confirm within one business day.</p>;
              return (
                <details className="card p-5">
                  <summary className="cursor-pointer text-sm font-medium">Government police, sheriff, corrections, fire, or EMS agency? Get 30% off →</summary>
                  <form action={requestPublicSafety} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <div><label className="field-label" htmlFor="agency_type">Agency type</label>
                      <select id="agency_type" name="agency_type" required className="field">
                        {['Police department', 'Sheriff’s office', 'State police / highway patrol', 'Corrections', 'Fire department', 'EMS agency', 'Federal law enforcement', 'Other government public safety'].map((t) => <option key={t}>{t}</option>)}
                      </select></div>
                    <div><label className="field-label" htmlFor="official_site">Official agency website</label><input id="official_site" name="official_site" type="url" required placeholder="https://www.yourcity.gov/police" className="field" /></div>
                    <button className="btn btn-outline">Request rate</button>
                  </form>
                  {searchParams.ps === 'invalid' && <p className="mt-2 text-sm text-signal">Choose your agency type and enter your official website (starting with https://).</p>}
                </details>
              );
            })()}

            <nav className="grid gap-3 sm:grid-cols-3">
              <div className="card p-5 sm:col-span-3">
                <p className="eyebrow">Refer an employer · earn a free month</p>
                <p className="mt-1 text-sm text-muted">When a company you invite verifies and starts a paid plan, you get a $249 credit — one Professional month — applied to your next bill.</p>
                <input readOnly value={`https://lancenest.com/signup?role=employer&ref=c-${company.slug}`} className="field mt-3 text-xs" aria-label="Your employer invite link" />
              </div>
              <Link href="/employer/team" className="card p-5 hover:border-brass"><p className="eyebrow">Hiring team</p><p className="mt-2 font-serif text-xl text-navy">Recruiter seats →</p></Link>
              <Link href="/employer/talent" className="card p-5 hover:border-brass"><p className="eyebrow">Talent pools</p><p className="mt-2 font-serif text-xl text-navy">Saved candidates →</p></Link>
              <Link href="/employer/company" className="card p-5 hover:border-brass"><p className="eyebrow">Company page</p><p className="mt-2 font-serif text-xl text-navy">Logo, cover & story →</p></Link>
              <Link href="/employer/candidates" className="card p-5 hover:border-brass"><p className="eyebrow">Candidate search</p><p className="mt-2 font-serif text-xl text-navy">Find veterans →</p></Link>
              <Link href="/employer/analytics" className="card p-5 hover:border-brass"><p className="eyebrow">Hiring analytics</p><p className="mt-2 font-serif text-xl text-navy">Views & applicants →</p></Link>
              <Link href="/employer/training" className="card p-5 hover:border-brass"><p className="eyebrow">Training listings</p><p className="mt-2 font-serif text-xl text-navy">List programs →</p></Link>
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
                {(company as unknown as { isOwner: boolean }).isOwner && company.plan === 'free' && (
                  <>
                    <form action="/api/billing/checkout" method="post"><input type="hidden" name="product" value="employer_professional_month" /><button className="btn btn-primary">Professional · $249/mo (Founding: $149 first year)</button></form>
                    <form action="/api/billing/checkout" method="post"><input type="hidden" name="product" value="job_slot" /><button className="btn btn-outline">+1 job slot · $39/mo</button></form>
                  </>
                )}
                {company.plan === 'professional' && (
                  <form action="/api/billing/checkout" method="post"><input type="hidden" name="product" value="employer_federal_month" /><button className="btn btn-primary">Upgrade to Federal · $499/mo</button></form>
                )}
                <Link href="/settings/account" className="btn btn-ghost border border-line">Account</Link>
                {(company as unknown as { isOwner: boolean }).isOwner && company.stripe_customer_id && (
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
