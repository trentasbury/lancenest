import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionProfile } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Hire Veterans',
  description: 'Recruit verified service members and veterans. Plans for every size of hiring team.',
};

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    note: 'To get started',
    features: ['Company recruiting page', '2 open job posts', 'Applicant inbox'],
    cta: 'Create a free account',
  },
  {
    name: 'Professional',
    price: '$149',
    note: 'per month · $1,490/year (2 months free)',
    features: ['Unlimited job posts', 'Veteran candidate search', 'Message candidates first', 'Hiring analytics', '2 featured jobs each month (included)'],
    cta: 'Start with Professional',
    featured: true,
  },
  {
    name: 'Federal',
    price: '$499',
    note: 'per month · $4,990/year',
    features: ['Everything in Professional', 'Cleared-talent search by clearance level', 'Clearance-holder spotlight', 'Unlimited featured jobs', '3 recruiter seats'],
    cta: 'Start with Federal',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    note: 'from $12,000/year',
    features: ['Everything in Federal', 'Unlimited recruiter seats', 'Employer branding', 'ATS integration', 'Dedicated support'],
    cta: 'Talk to us',
  },
];

// Perks still being built are labeled so no one pays for something that isn't live yet.
const COMING_SOON = new Set(['Veteran candidate search', 'Message candidates first', 'Hiring analytics', 'Cleared-talent search by clearance level', 'Clearance-holder spotlight', '3 recruiter seats', 'Unlimited recruiter seats', 'Employer branding', 'ATS integration']);

const CHECKOUT: Record<string, string> = { Professional: 'employer_professional', Federal: 'employer_federal' };

export default async function EmployersPage() {
  const session = await getSessionProfile();
  const isEmployer = session?.profile?.role === 'employer';
  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page py-16 text-center">
          <p className="eyebrow text-brass">For Employers</p>
          <h1 className="mx-auto mt-4 max-w-3xl font-serif text-5xl font-medium leading-tight text-ivory">
            Hire people who’ve already proven they deliver.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-cream/80">
            LanceNest translates military experience into the language your hiring managers use — so you see leaders,
            operators, and specialists instead of unfamiliar acronyms.
          </p>
        </div>
      </section>

      <div className="container-page py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`card flex flex-col p-8 ${plan.featured ? 'border-brass ring-1 ring-brass' : ''}`}>
              {plan.featured && <p className="eyebrow mb-3">Most popular</p>}
              <h2 className="font-serif text-2xl font-semibold">{plan.name}</h2>
              <p className="mt-4 font-serif text-5xl font-medium text-navy">{plan.price}</p>
              <p className="text-sm text-muted">{plan.note}</p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-ink/85">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-brass">✦</span>
                    <span>{f}{COMING_SOON.has(f) && <span className="ml-1.5 rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Coming soon</span>}</span>
                  </li>
                ))}
              </ul>
              {isEmployer && CHECKOUT[plan.name] ? (
                <div className="mt-8 space-y-2">
                  <form action="/api/billing/checkout" method="post"><input type="hidden" name="product" value={`${CHECKOUT[plan.name]}_month`} /><button className={`btn w-full ${plan.featured ? 'btn-primary' : 'btn-outline'}`}>Choose monthly</button></form>
                  <form action="/api/billing/checkout" method="post"><input type="hidden" name="product" value={`${CHECKOUT[plan.name]}_year`} /><button className="btn btn-ghost w-full border border-line">Choose annual · 2 months free</button></form>
                </div>
              ) : isEmployer && plan.name === 'Free' ? (
                <Link href="/employer/dashboard" className="btn btn-outline mt-8">Go to dashboard</Link>
              ) : (
                <Link href="/signup?role=employer" className={`btn mt-8 ${plan.featured ? 'btn-primary' : 'btn-outline'}`}>
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted">
          Every employer account starts free. Upgrade, downgrade, or cancel anytime from your dashboard. Add-ons: featured job boost $49 · extra job slot $39/month.
        </p>
      </div>
    </>
  );
}
