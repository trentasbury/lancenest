import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Hire Veterans',
  description: 'Recruit verified service members and veterans. Plans for every size of hiring team.',
};

const PLANS = [
  {
    name: 'Employer',
    price: 'Free',
    note: 'To get started',
    features: ['Company profile page', 'Limited job postings', 'Basic applicant management'],
    cta: 'Create a free account',
  },
  {
    name: 'Professional',
    price: '$199',
    note: 'per month',
    features: ['More job postings', 'Veteran candidate search', 'Direct messaging', 'Hiring analytics', 'Featured jobs'],
    cta: 'Start with Professional',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    note: 'For large hiring programs',
    features: ['Unlimited jobs', 'Advanced candidate search', 'Employer branding', 'Analytics', 'Dedicated support'],
    cta: 'Talk to us',
  },
];

export default function EmployersPage() {
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
        <div className="grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`card flex flex-col p-8 ${plan.featured ? 'border-brass ring-1 ring-brass' : ''}`}>
              {plan.featured && <p className="eyebrow mb-3">Most popular</p>}
              <h2 className="font-serif text-2xl font-semibold">{plan.name}</h2>
              <p className="mt-4 font-serif text-5xl font-medium text-navy">{plan.price}</p>
              <p className="text-sm text-muted">{plan.note}</p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-ink/85">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2"><span className="text-brass">✦</span>{f}</li>
                ))}
              </ul>
              <Link href="/signup?role=employer" className={`btn mt-8 ${plan.featured ? 'btn-primary' : 'btn-outline'}`}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted">
          Every employer account starts free. Paid plans are activated from your employer dashboard once billing launches.
        </p>
      </div>
    </>
  );
}
