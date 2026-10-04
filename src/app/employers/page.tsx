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
    features: ['No placement fees on your hires', 'Company recruiting page', '2 open job posts', 'Applicant pipeline with résumés and verified work', 'Free, unlimited messaging with any verified member'] },
  { name: 'Professional', price: '$249', note: 'per month · or $2,490/year paid up front (2 months free)', cta: 'Start with Professional', featured: true,
    features: ['10 open job posts (extra slots $39/mo)', 'Search every verified member’s full profile', 'Transitioning talent search (separating in 12 months)', 'Hiring analytics: views, applicants, conversion', '5 featured jobs a month, included', 'Talent pools: save candidates to lists with private notes', 'Saved searches with daily new-match emails', '2 team seats', 'Branded company page: cover photo and “Why veterans work here”', 'Applicant export (CSV)'] },
  { name: 'Federal', price: '$999', note: 'per month · or $9,990/year paid up front (2 months free) · Founding Employers: $7,500 for the first year, paid up front', cta: 'Start with Federal',
    features: ['Everything in Professional', 'Built for primes, subs, and GovCon small businesses', 'Search by self-reported clearance level (you confirm eligibility in official systems)', 'Cleared talent spotlight', '5 team seats', 'Unlimited featured jobs', 'Priority support from the founder'] },
  { name: 'Enterprise', price: 'Custom', note: 'from $15,000/year', cta: 'Talk to us',
    features: ['Everything in Federal', 'Volume pricing for multiple hiring teams', 'Invoice billing', 'Dedicated support'] },
];

const CHECKOUT: Record<string, string> = { Professional: 'employer_professional', Federal: 'employer_federal' };

export default async function EmployersPage() {
  const { foundingSpotsLeft } = await import('@/lib/billing');
  const spotsLeft = await foundingSpotsLeft().catch(() => 0);
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
            Built for federal primes, subcontractors, and GovCon small businesses. Every candidate’s military service is verified. Post jobs, search, and hire directly —
            subscriptions only, like the job boards you already use.
          </p>
          <p className="mx-auto mt-6 inline-block rounded-full border border-brass bg-brass/15 px-5 py-2 text-sm font-semibold text-brass">No placement fees on hires you make yourself — ever.</p>
          {spotsLeft > 0 && (
            <div className="mx-auto mt-5 max-w-2xl rounded-[6px] border border-brass/60 bg-navy/60 p-4 text-sm text-cream">
              <strong className="text-brass">Founding Employer offer · {spotsLeft} of 50 spots left.</strong> Professional for <strong>$1,490 your first year</strong> (save $1,000), or Federal for <strong>$7,500 your first year</strong> (regularly $11,988). Paid up front, launch pricing locked in.
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/signup?role=employer" className="btn btn-brass" data-track="cta_employer_post_free">Post a job free</Link>
            <Link href="/contact-sales?plan=federal" className="btn border border-cream/40 text-cream hover:border-brass" data-track="cta_employer_book_call">Book a call</Link>
          </div>
          <p className="mx-auto mt-4 max-w-2xl rounded-[4px] border border-brass/40 bg-white/5 px-4 py-3 text-sm text-cream/90">
            <strong className="text-brass">Any company can hire here.</strong> You don’t need to be veteran-owned or have served — if you want to hire
            service members, you belong on LanceNest. We simply verify that your company is real to keep veterans safe.
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
                <Link href={plan.name === 'Enterprise' ? '/contact-sales?plan=enterprise' : '/signup?role=employer'} className={`btn mt-8 ${plan.featured ? 'btn-primary' : 'btn-outline'}`}>
                  {plan.name === 'Enterprise' ? 'Book a call' : plan.cta}
                </Link>
              )}
              {plan.name === 'Federal' && <Link href="/contact-sales?plan=federal" className="mt-2 block text-center text-sm text-navy underline decoration-brass underline-offset-4">or book a call</Link>}
            </div>
          ))}
        </div>

          <div className="mt-12 overflow-x-auto rounded-[6px] border border-line bg-ivory" tabIndex={0} role="region" aria-label="Plan comparison">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line bg-paper text-xs uppercase tracking-[0.12em] text-muted"><tr><th className="p-3">Compare plans</th><th className="p-3">Free</th><th className="p-3">Professional</th><th className="p-3">Federal</th><th className="p-3">Enterprise</th></tr></thead>
              <tbody className="divide-y divide-line">
                <tr><td className="p-3 font-medium">Verified company page</td><td className="p-3">✓</td><td className="p-3">✓</td><td className="p-3">✓</td><td className="p-3">✓</td></tr>
                <tr><td className="p-3 font-medium">Team seats</td><td className="p-3">1</td><td className="p-3">2</td><td className="p-3">5</td><td className="p-3">Custom</td></tr>
                <tr><td className="p-3 font-medium">Open jobs</td><td className="p-3">2</td><td className="p-3">10</td><td className="p-3">Unlimited</td><td className="p-3">Unlimited</td></tr>
                <tr><td className="p-3 font-medium">Screening questions and applicant pipeline</td><td className="p-3">✓</td><td className="p-3">✓</td><td className="p-3">✓</td><td className="p-3">✓</td></tr>
                <tr><td className="p-3 font-medium">Message applicants</td><td className="p-3">✓</td><td className="p-3">✓</td><td className="p-3">✓</td><td className="p-3">✓</td></tr>
                <tr><td className="p-3 font-medium">Search all verified members</td><td className="p-3">Preview</td><td className="p-3">✓</td><td className="p-3">✓ + clearance filters</td><td className="p-3">✓</td></tr>
                <tr><td className="p-3 font-medium">New conversations with any member</td><td className="p-3">—</td><td className="p-3">100/month</td><td className="p-3">500/month</td><td className="p-3">2,000/month</td></tr>
                <tr><td className="p-3 font-medium">Saved searches, talent pools, notes</td><td className="p-3">—</td><td className="p-3">✓</td><td className="p-3">✓ (team-shared)</td><td className="p-3">✓</td></tr>
                <tr><td className="p-3 font-medium">Featured jobs</td><td className="p-3">Add-on</td><td className="p-3">5/month</td><td className="p-3">Unlimited</td><td className="p-3">Unlimited</td></tr>
                <tr><td className="p-3 font-medium">Reports and CSV export</td><td className="p-3">Basic</td><td className="p-3">✓</td><td className="p-3">✓ + compliance export</td><td className="p-3">Custom</td></tr>
                <tr><td className="p-3 font-medium">Support</td><td className="p-3">Email</td><td className="p-3">Email</td><td className="p-3">Priority</td><td className="p-3">Dedicated contact</td></tr>
                <tr><td className="p-3 font-medium">Invoicing, security review, custom terms</td><td className="p-3">—</td><td className="p-3">—</td><td className="p-3">—</td><td className="p-3">✓</td></tr>
              </tbody>
            </table>
          </div>
        <p className="mt-8 text-center text-sm text-muted">
          Every employer account starts free, and no plan ever charges a fee when you hire. Upgrade, downgrade, or cancel anytime. Add-ons: featured job boost $49 · extra job slot $39/month. <strong>Public Safety rate:</strong> government police, sheriff, corrections, fire, and EMS agencies get 30% off Professional and Federal — annual invoicing available. <strong>Virtual career fair booths:</strong> $499, or $399 on Professional and Federal. <strong>Training providers:</strong> list programs for $149/month (featured +$99/month; sponsored info sessions $500).
        </p>
      </div>
      <section className="bg-paper">
        <div className="container-page grid gap-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {[['Candidate quality', 'Verified military service — not a background check or clearance verification.'],
            ['Candidate readiness', 'See availability, target roles, location, target pay, and civilian skills before you reach out.'],
            ['Employer trust', 'Every employer is verified before posting a job or contacting members.'],
            ['Hiring workflow', 'Post jobs with screening questions, track applicants, save candidates to talent pools, and message directly.']].map(([h, b]) => (
            <div key={h} className="card p-5"><p className="font-semibold text-navy">{h}</p><p className="mt-1 text-sm text-muted">{b}</p></div>
          ))}
          <p className="text-sm text-muted sm:col-span-2 lg:col-span-4">Founding employers work directly with the LanceNest team while the verified network grows. <Link href="/trust" className="text-navy underline">What “verified” means →</Link></p>
        </div>
      </section>
      <section className="border-y border-line bg-paper">
        <div className="container-page flex flex-col items-start justify-between gap-4 py-10 md:flex-row md:items-center">
          <div><p className="eyebrow">Need help finding someone?</p><p className="mt-2 font-serif text-2xl text-navy">Talk with our team about a hard-to-fill role.</p>
            <p className="mt-1 text-sm text-muted">We’ll walk you through search filters, saved-search alerts, and job promotion to reach the right verified members.</p></div>
          <Link href="/contact-sales" className="btn btn-primary shrink-0">Book a call</Link>
        </div>
      </section>
    </>
  );
}
