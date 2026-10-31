import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import { CATEGORIES } from '@/lib/freelance';
import { FREELANCE_PAYMENTS_ENABLED, LICENSED_TRADES } from '@/lib/flags';
import { CANONICAL_ORIGIN } from '@/lib/seo';
import { formStartToken } from '@/lib/projectDrafts';
import GuestPostForm from './GuestPostForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Post a freelance project',
  description: 'Hire a verified veteran or military spouse: describe the job, create a free client account in the same step, and verified pros send proposals.',
  alternates: { canonical: `${CANONICAL_ORIGIN}/hire/post` },
};

export default async function GuestPostPage() {
  const session = await getSessionProfile();
  const role = session?.profile?.role;
  if (role === 'client' || role === 'employer') redirect('/freelance/projects/new');
  const feeNote = FREELANCE_PAYMENTS_ENABLED
    ? 'Posting is free. When you hire, you pay the client fees shown before you pay.'
    : 'Posting is free. When you hire, you pay LanceNest a small booking fee based on the job price, shown before you pay and refunded if the pro declines within 48 hours.';
  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page py-12">
          <p className="eyebrow text-brass">Post a project</p>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl font-medium leading-tight text-ivory sm:text-5xl">Tell us the job. Verified veterans send proposals.</h1>
          <p className="mt-3 max-w-2xl text-cream/80">You don’t need to be a veteran to hire one. Describe the work and create your free client account in the same step. It goes live as soon as you confirm your email.</p>
        </div>
      </section>
      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_300px]">
        {role === 'veteran' || role === 'admin' ? (
          <div className="card p-8">
            <p className="font-semibold text-ink">You’re signed in with a member account.</p>
            <p className="mt-2 text-sm text-muted">Member accounts send proposals rather than posting projects. To hire for yourself, sign out and post with a separate client account, or <Link href="/freelance" className="text-navy underline">find freelance work</Link>.</p>
          </div>
        ) : (
          <GuestPostForm started={formStartToken()} categories={CATEGORIES} licensed={LICENSED_TRADES} feeNote={feeNote} />
        )}
        <aside className="space-y-4 text-sm">
          <div className="card p-5"><p className="eyebrow">Who answers</p><p className="mt-2 text-ink/85">Only service members, veterans and military spouses whose service a person has checked. Licensed trades show a verified license.</p></div>
          <div className="card p-5"><p className="eyebrow">How we keep it safe</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-ink/85">
              <li>A bot check and email confirmation on every new account</li>
              <li>Projects asking for fees, gift cards, checks or payment apps are blocked</li>
              <li>Phone numbers, emails and links stay hidden until a job is booked</li>
              <li>Our team reviews every project posted from this page</li>
            </ul></div>
        </aside>
      </div>
    </>
  );
}
