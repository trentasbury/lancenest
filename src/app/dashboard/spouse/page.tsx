import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SPOUSE_GRACE_DAYS, mySpouse } from '@/lib/spouse';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import SpouseInvite from './SpouseInvite';
import { confirmMySpouse, removeMySpouse } from './actions';

export const metadata: Metadata = { title: 'Invite your spouse', robots: { index: false } };

const longDate = (d: string) => new Date(d).toLocaleDateString('en-US', { dateStyle: 'long' });

export default async function SpousePage(props: { searchParams: Promise<{ confirmed?: string; removed?: string; error?: string }> }) {
  const searchParams = await props.searchParams;
  const { user } = await requireRole(['veteran'], '/dashboard/spouse');
  const { data: v } = await (await createClient()).from('veteran_profiles').select('verification_status, member_type').eq('profile_id', user.id).maybeSingle();
  const spouse = await mySpouse(user.id);
  const isSpouse = v?.member_type === 'spouse';
  const verified = v?.verification_status === 'verified';

  return (
    <div className="container-page max-w-2xl py-12">
      <Link href="/dashboard" className="text-sm text-muted hover:text-navy">← Dashboard</Link>
      <h1 className="mt-3 font-serif text-4xl font-medium">Invite your spouse</h1>
      <p className="mt-2 text-muted">
        Military spouses can join LanceNest free, with remote and portable jobs, freelance work and the network. Your invite verifies them
        right away, so they don’t need to upload documents.
      </p>
      {searchParams.removed && <div className="mt-6"><FormMessage message="The link is removed. You can invite a new spouse when you’re ready." /></div>}
      <div className="card mt-8 p-7">
        {isSpouse ? (
          <p className="text-sm text-muted">This page is for service members and veterans inviting their spouse.</p>
        ) : !verified ? (
          <p className="text-sm text-muted">Verify your own service first, then come back here to invite your spouse. <Link href="/dashboard/verification" className="text-navy underline">Verify my service</Link></p>
        ) : spouse ? (
          <div className="space-y-5">
            {searchParams.confirmed && <FormMessage message="Thank you. Your spouse’s status is confirmed for another year." />}
            <p className="text-sm text-ink/85">✓ Linked: {spouse.username ? <Link href={`/veterans/${spouse.username}`} className="text-navy underline">{spouse.name}</Link> : spouse.name} is a verified LanceNest member through your invite.</p>
            {spouse.surviving ? null : (
              <div className="rounded-xl border border-line bg-paper p-4">
                <p className="text-sm font-semibold text-ink">Yearly check</p>
                <p className="mt-1 text-sm text-muted">
                  {spouse.graceUntil
                    ? <>The yearly confirmation was missed. {spouse.name.split(' ')[0]}’s spouse status ends on <strong className="text-ink">{longDate(spouse.graceUntil)}</strong> unless you confirm.</>
                    : spouse.confirmedUntil ? <>Confirmed until <strong className="text-ink">{longDate(spouse.confirmedUntil)}</strong>. We’ll remind you a month before.</> : 'Confirm once a year that you’re still married.'}
                </p>
                <form action={confirmMySpouse} className="mt-3"><SubmitButton className="btn btn-primary" pendingText="Saving…">We’re still married: confirm for a year</SubmitButton></form>
              </div>
            )}
            <form action={removeMySpouse} className="rounded-xl border border-signal/30 p-4">
              <p className="text-sm font-semibold text-ink">Divorced or separated?</p>
              <p className="mt-1 text-sm text-muted">Remove the link. {spouse.name.split(' ')[0]} keeps their account, and their spouse status stays on for {SPOUSE_GRACE_DAYS} days so they can verify with their own documents. We’ll tell them; we won’t tell them why.</p>
              {searchParams.error === 'sure' && <p className="mt-2 text-xs font-semibold text-signal">Tick the box to confirm.</p>}
              <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" name="sure" className="mt-0.5 accent-signal" />I want to remove my spouse link</label>
              <SubmitButton className="btn btn-outline mt-3 border-signal text-signal" pendingText="Removing…">Remove link</SubmitButton>
            </form>
          </div>
        ) : (
          <SpouseInvite />
        )}
      </div>
      <p className="mt-4 text-xs text-muted">One linked spouse per account, confirmed once a year. Spouses can also verify on their own with documents, such as orders listing them as a dependent.</p>
    </div>
  );
}
