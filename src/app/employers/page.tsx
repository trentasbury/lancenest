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
    features: ['Company recruiting page', '2 open job posts', 'Applicant pipeline with résumés and verified work', 'Free, unlimited messaging with any verified member'] },
  { name: 'Professional', price: '$249', note: 'per month · or $2,490/year paid up front (2 months free)', cta: 'Start with Professional', featured: true,
    features: ['Unlimited job posts', 'Search every verified member’s full profile', 'Transitioning talent search (separating in 12 months)', 'Hiring analytics: views, applicants, conversion', '5 featured jobs a month, included', 'Talent pools: save candidates to lists with private notes', 'Saved searches with daily new-match emails', '2 team seats', 'Branded company page: cover photo and “Why veterans work here”', 'Applicant export (CSV)'] },
  { name: 'Federal', price: '$999', note: 'per month · or $9,990/year paid up front (2 months free) · Founding Employers: $800/month for the first 12 months', cta: 'Start with Federal',
    features: ['Everything in Professional', 'Built for primes, subs, and GovCon small businesses', 'Search by self-reported clearance level (you confirm eligibility in official systems)', 'Cleared talent spotlight', '5 team seats', 'Unlimited featured jobs', 'Priority support from the founder'] },
  { name: 'Enterprise', price: 'Custom', note: 'from $15,000/year', cta: 'Talk to us',
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
            Verified, federal-ready veteran talent — in days, not months.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-cream/80">
            Built for federal primes, subcontractors, and GovCon small businesses. Every candidate’s military service is verified,
            and our team can hand-deliver a shortlist of interested, available service members in 3 business days.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/employer/shortlists" className="btn btn-brass">Get a Verified Shortlist</Link>
            <Link href="/contact-sales?plan=federal" className="btn border border-cream/40 text-cream hover:border-brass">Book a call</Link>
          </div>
          <p className="mx-auto mt-4 max-w-2xl rounded-[4px] border border-brass/40 bg-white/5 px-4 py-3 text-sm text-cream/90">
            <strong className="text-brass">Any company can hire here.</strong> You don’t need to be veteran-owned or have served — if you want to hire
            service members, you belong on LanceNest. We simply verify that your company is real to keep veterans safe.
          </p>
        </div>
      </section>
      <section className="border-b border-line bg-paper">
        <div className="container-page grid gap-6 py-10 md:grid-cols-3">
          <div><p className="eyebrow">Verified Shortlist</p><p className="mt-2 font-serif text-2xl text-navy">$750 per role</p><p className="mt-1 text-sm text-muted">3 verified, interested, available candidates in 3 business days — free re-run if none fit. $500 on Professional and Federal.</p></div>
          <div><p className="eyebrow">Placement</p><p className="mt-2 font-serif text-2xl text-navy">15% of first-year salary</p><p className="mt-1 text-sm text-muted">Only when you hire from a shortlist — agencies typically charge 15–25%. Shortlist fee credited; 90-day replacement guarantee.</p></div>
          <div><p className="eyebrow">Contract & freelance</p><p className="mt-2 font-serif text-2xl text-navy">Protected Payments</p><p className="mt-1 text-sm text-muted">Fund milestones, approve the work, and convert to full-time anytime (10% within 12 months, free after).</p></div>
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
                <Link href={plan.name === 'Enterprise' ? '/contact-sales?plan=enterprise' : '/signup?role=employer'} className={`btn mt-8 ${plan.featured ? 'btn-primary' : 'btn-outline'}`}>
                  {plan.name === 'Enterprise' ? 'Book a call' : plan.cta}
                </Link>
              )}
              {plan.name === 'Federal' && <Link href="/contact-sales?plan=federal" className="mt-2 block text-center text-sm text-navy underline decoration-brass underline-offset-4">or book a call</Link>}
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted">
          Every employer account starts free. Upgrade, downgrade, or cancel anytime from your dashboard. Add-ons: featured job boost $49 · extra job slot $39/month. <strong>Public Safety rate:</strong> government police, sheriff, corrections, fire, and EMS agencies get 30% off Professional and Federal — annual invoicing available. <strong>Virtual career fair booths:</strong> $499, or $399 on Professional and Federal. <strong>Training providers:</strong> list programs for $149/month (featured +$99/month; sponsored info sessions $500).
        </p>
      </div>
    </>
  );
}
