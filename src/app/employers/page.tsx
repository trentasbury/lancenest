import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionProfile } from '@/lib/auth';
import { foundingSpotsLeft } from '@/lib/billing';

export const metadata: Metadata = {
  title: 'Hire Veterans',
  description: 'Recruit verified service members and veterans. Plans for every size of hiring team.',
};

const PLANS = [
  { name: 'Free', price: '$0', note: 'To get started', cta: 'Create a free account',
    features: ['Company recruiting page', '2 open job posts', 'Applicant pipeline', 'Message candidates who apply'] },
  { name: 'Professional', price: '$199', note: 'per month · $1,990/year (2 months free)', cta: 'Start with Professional', featured: true,
    features: ['Unlimited job posts', 'Search every veteran profile', 'Message 50 new candidates a month', 'Hiring analytics', '5 featured jobs a month, included', 'Applicant export (CSV)'] },
  { name: 'Federal', price: '$499', note: 'per month · $4,990/year', cta: 'Start with Federal',
    features: ['Everything in Professional', 'Search by security clearance', 'Cleared talent spotlight', 'Unlimited candidate messages', 'Unlimited featured jobs'] },
  { name: 'Enterprise', price: 'Custom', note: 'from $12,000/year', cta: 'Talk to us',
    features: ['Everything in Federal', 'Volume pricing for multiple hiring teams', 'Invoice billing', 'Dedicated support'] },
];

const CHECKOUT: Record<string, string> = { Professional: 'employer_professional', Federal: 'employer_federal' };

export default async function EmployersPage() {
  const session = await getSessionProfile();
  const isEmployer = session?.profile?.role === 'employer';
  const founding = await foundingSpotsLeft();
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
              {plan.name === 'Professional' && founding > 0 && (
                <p className="mt-3 rounded-[3px] border border-brass bg-brass/10 px-3 py-2 text-xs font-semibold text-brass-dark">
                  Founding Employer: $149/mo for your first 12 months ($1,490 first year on annual) · {founding} of 50 spots left
                </p>
              )}
              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-ink/85">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-brass">✦</span>
                    <span>{f}</span>
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
          Every employer account starts free. Upgrade, downgrade, or cancel anytime from your dashboard. Add-ons: featured job boost $49 · extra job slot $39/month · 5 candidate contacts $59.
        </p>
      </div>
    </>
  );
}
