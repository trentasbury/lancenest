import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import RenewalNote from '@/components/RenewalNote';
import { AI_ENABLED } from '@/lib/ai';
import { cookies } from 'next/headers';
import PartnerCodeForm from '@/components/PartnerCodeForm';

export const metadata: Metadata = { alternates: { canonical: '/plans' },
  title: 'Plans for Veterans',
  description: 'LanceNest is free for every service member. Pro plans add visibility and tools for your job search.',
};

const PLANS = [
  { id: null, key: 'free', name: 'Free', price: '$0', note: 'Always, for every verified service member',
    features: ['Verified profile with military & professional career', 'Apply to every job with up to 3 résumés', 'Network, messaging, and People search',
      'Transition Hub & SkillBridge', 'See how many people viewed your profile', '5 freelance proposals a month, plus 5 more for $5 anytime', ...(AI_ENABLED ? ['3 AI résumé and job-fit drafts a month'] : []), 'Freelance fee: 10% (you keep 90%)'] },
  { id: 'veteran_pro' as const, key: 'pro', name: 'Pro', price: '$25', note: 'per month · or $229/year paid up front (save 24%)', month: 'veteran_pro_month', year: 'veteran_pro_year',
    features: ['Everything in Free', 'See exactly who viewed your profile', 'Applicant insights: how you compare on every job', 'Daily job alerts by email (3)', 'Unlimited freelance proposals', 'Pro badge on your profile', ...(AI_ENABLED ? ['40 AI résumé and job-fit drafts a month'] : []), 'Freelance fee: 7%'] },
  { id: 'veteran_pro_plus' as const, key: 'pro_plus', name: 'Career Accelerator', price: '$45', note: 'per month · or $399/year paid up front (save 26%)', month: 'veteran_pro_plus_month', year: 'veteran_pro_plus_year', featured: true,
    features: ['Everything in Pro', 'Military résumé builder: a civilian-ready résumé draft in one click — then edit and tailor it', 'Applicant insights and 10 job alerts, including cleared-only', '48-hour early access to jobs that list a clearance requirement (your clearance is self-reported)', 'Priority applicant: listed first on jobs and freelance proposals, labeled for employers', 'Featured profile boost twice a month — clearly labeled for employers', 'Priority messages in employer inboxes', ...(AI_ENABLED ? ['60 AI résumé and job-fit drafts a month'] : []), 'Freelance: unlimited proposals · 5% fee'] },
];

export default async function PlansPage(props: { searchParams: Promise<{ code?: string }> }) {
  const { code: codeResult } = await props.searchParams;
  const partnerCookie = (await cookies()).get('ln_partner')?.value;
  const session = await getSessionProfile();
  const isVeteran = session?.profile?.role === 'veteran';
  let currentPlan = 'free';
  if (isVeteran && session) {
    const { data } = await (await createClient()).from('veteran_profiles').select('plan').eq('profile_id', session.user.id).maybeSingle();
    currentPlan = (data?.plan as string) ?? 'free';
  }

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page py-16 text-center">
          <p className="eyebrow text-brass">Plans for Veterans</p>
          <h1 className="mx-auto mt-4 max-w-3xl font-serif text-5xl font-medium leading-tight text-ivory">Free for every service member. Pro when you want an edge.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-cream/80">
            Your profile, verification, and every job on LanceNest cost nothing. Upgrade anytime; cancel anytime from your billing page.
          </p>
          <p className="mx-auto mt-4 inline-block rounded-full border border-brass/60 px-4 py-1.5 text-sm text-brass-light">Separating within a year? Verified members get 90 days of Pro free. <a href="/transition" className="underline">Add your date</a></p>
        </div>
      </section>

      <div className="container-page py-16">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => {
            return (
              <div key={plan.name} className={`card flex flex-col p-8 ${plan.featured ? 'border-brass ring-1 ring-brass' : ''}`}>
                {plan.featured && <p className="eyebrow mb-3">Recommended</p>}
                <h2 className="font-serif text-2xl font-semibold">{plan.name}</h2>
                <p className="mt-4 font-serif text-5xl font-medium text-navy">{plan.price}</p>
                <p className="text-sm text-muted">{plan.note}</p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm text-ink/85">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2"><span className="text-brass">✦</span>{f}</li>
                  ))}
                </ul>
                <div className="mt-8">
                  {!plan.id ? (
                    session ? <p className="rounded-lg border border-line px-4 py-3 text-center text-sm text-muted">{currentPlan === 'free' ? 'Your current plan' : 'Included'}</p>
                      : <Link href="/signup?role=veteran" className="btn btn-outline w-full">Create a free profile</Link>
                  ) : !session ? (
                    <Link href="/login?next=/plans" className="btn btn-primary w-full">Log in to upgrade</Link>
                  ) : !isVeteran ? (
                    <p className="text-center text-sm text-muted">Member plans are for service member accounts.</p>
                  ) : (plan.key === 'pro_plus' ? ['pro_plus', 'federal_pro'].includes(currentPlan) : currentPlan === plan.key) ? (
                    <form action="/api/billing/portal" method="post"><button className="btn btn-outline w-full">✓ Your plan · Manage billing</button></form>
                  ) : (
                    <div className="space-y-2">
                      <form action="/api/billing/checkout" method="post"><input type="hidden" name="product" value={plan.month} /><button className={`btn w-full ${plan.featured ? 'btn-primary' : 'btn-outline'}`}>{currentPlan !== 'free' ? 'Switch' : 'Upgrade'} · {plan.price}/mo</button></form>
                      <form action="/api/billing/checkout" method="post"><input type="hidden" name="product" value={plan.year} /><button className="w-full text-center text-xs text-navy underline decoration-brass underline-offset-4">or pay yearly and save 24–26%</button></form>
                      <RenewalNote className="text-center" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {isVeteran && <div className="mx-auto mt-8 max-w-3xl"><PartnerCodeForm back="/plans" result={codeResult} prefill={partnerCookie} /></div>}
        <p className="mt-8 text-center text-sm text-muted">Cancel anytime from Manage billing. Paying yearly saves $71 on Pro ($229 vs. $300) and $141 on Career Accelerator ($399 vs. $540). Freelancing? At about $850 a month in LanceNest project earnings, Pro pays for itself through its 3-point lower fee. Clearances on LanceNest are self-reported; employers confirm eligibility through official channels.</p>
      </div>
    </>
  );
}
