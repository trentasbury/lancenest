import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import SubmitButton from '@/components/SubmitButton';
import { joinWaitlist } from './actions';

export const metadata: Metadata = {
  title: 'Plans for Veterans',
  description: 'LanceNest is free for every service member. Pro plans add visibility and tools for your job search.',
};

const PLANS = [
  {
    id: null,
    name: 'Member',
    price: 'Free',
    note: 'Always, for every service member',
    features: ['Freelance fee: 15%', 'Full profile & military translation', 'Verified Veteran badge', 'Search and apply to every job', 'Save jobs'],
  },
  {
    id: 'veteran_pro' as const,
    name: 'Pro',
    price: '$19',
    note: 'per month · $190/year (2 months free)',
    featured: true,
    features: ['Freelance fee: 10% (save a third)', 'Everything in Member', 'Featured placement in employer searches', 'See which employers viewed your profile', 'Unlimited job alerts', 'Priority verification review', 'Pro badge on your profile'],
  },
  {
    id: 'veteran_federal_pro' as const,
    name: 'Federal Pro',
    price: '$29',
    note: 'per month · $290/year (2 months free)',
    features: ['Freelance fee: 8% — lowest on LanceNest', 'Everything in Pro', 'Clearance holders spotlighted to federal contractors', 'Early access to cleared and GovCon roles', 'Federal Pro badge on your profile'],
  },
];

export default async function PlansPage() {
  const session = await getSessionProfile();
  const isVeteran = session?.profile?.role === 'veteran';
  let joined: string[] = [];
  if (isVeteran && session) {
    const { data } = await createClient().from('plan_waitlist').select('plan').eq('profile_id', session.user.id);
    joined = (data ?? []).map((r) => r.plan as string);
  }

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page py-16 text-center">
          <p className="eyebrow text-brass">Plans for Veterans</p>
          <h1 className="mx-auto mt-4 max-w-3xl font-serif text-5xl font-medium leading-tight text-ivory">Free for every service member. Pro when you want an edge.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-cream/80">
            Your profile, verification, and every job on LanceNest cost nothing. Pro plans are launching soon — join the list and you’ll be first in line.
          </p>
        </div>
      </section>

      <div className="container-page py-16">
        <div className="grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const onList = plan.id ? joined.includes(plan.id) : false;
            return (
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
                <div className="mt-8">
                  {!plan.id ? (
                    session ? (
                      <Link href="/dashboard" className="btn btn-outline w-full">Your current plan</Link>
                    ) : (
                      <Link href="/signup?role=veteran" className="btn btn-outline w-full">Create a free profile</Link>
                    )
                  ) : !session ? (
                    <Link href="/login?next=/plans" className="btn btn-primary w-full">Log in to join the waitlist</Link>
                  ) : !isVeteran ? (
                    <p className="text-center text-sm text-muted">Pro plans are for veteran accounts.</p>
                  ) : onList ? (
                    <p className="rounded-[3px] border border-olive/30 bg-olive/10 px-4 py-3 text-center text-sm font-medium text-olive">✓ You’re on the waitlist</p>
                  ) : (
                    <form action={joinWaitlist.bind(null, plan.id)}>
                      <SubmitButton className={`btn w-full ${plan.featured ? 'btn-primary' : 'btn-outline'}`} pendingText="Joining…">Join the waitlist</SubmitButton>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-8 text-center text-sm text-muted">No payment is collected yet. We’ll email you before Pro launches.</p>
      </div>
    </>
  );
}
