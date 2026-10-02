import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { addPortfolioItem, removePortfolioItem, saveFreelancerProfile } from '../actions';

export const metadata: Metadata = { title: 'Freelancer profile' };
const ERR: Record<string, string> = { title: 'Add a professional title.', save: 'That didn’t save — please try again.', portfolio: 'Portfolio items need a title (and a valid link if you add one).', profile_first: 'Save your freelancer profile first, then set up payouts.' };

export default async function FreelancerProfilePage({ searchParams }: { searchParams: { saved?: string; error?: string; payouts?: string } }) {
  const { user, profile } = await requireVerifiedMember('/freelance/profile');
  if (profile.role !== 'veteran') redirect('/freelance');
  const supabase = createClient();
  const [{ data: fp }, { data: items }] = await Promise.all([
    supabase.from('freelancer_profiles').select('*').eq('profile_id', user.id).maybeSingle(),
    supabase.from('portfolio_items').select('*').eq('profile_id', user.id).order('created_at', { ascending: false }),
  ]);

  // Refresh payout status from Stripe (the server is the only thing allowed to set it).
  let payoutsReady = !!fp?.payouts_enabled;
  if (fp?.stripe_account_id && !payoutsReady) {
    try {
      const acct = await stripe().accounts.retrieve(fp.stripe_account_id as string);
      payoutsReady = !!acct.payouts_enabled && acct.capabilities?.transfers === 'active';
      if (payoutsReady) await createAdminClient().from('freelancer_profiles').update({ payouts_enabled: true }).eq('profile_id', user.id);
    } catch (err) { console.error('stripe account check failed:', err); }
  }

  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <Link href="/freelance" className="text-sm text-muted hover:text-navy">← Freelance</Link>
      <h1 className="font-serif text-4xl font-medium">Your freelancer profile</h1>
      {searchParams.error && <FormMessage error={ERR[searchParams.error] ?? ERR.save} />}
      {searchParams.saved && <FormMessage message="Saved." />}

      <form action={saveFreelancerProfile} className="card grid gap-5 p-7 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="field-label" htmlFor="title">Professional title</label><input id="title" name="title" required defaultValue={fp?.title ?? profile.headline ?? ''} placeholder="e.g. enterprise software Developer · Cyber Analyst" className="field" /></div>
        <div className="sm:col-span-2"><label className="field-label" htmlFor="bio">What you do for clients</label><textarea id="bio" name="bio" rows={5} maxLength={3000} defaultValue={fp?.bio ?? ''} className="field" /></div>
        <div><label className="field-label" htmlFor="hourly_rate">Hourly rate (USD)</label><input id="hourly_rate" name="hourly_rate" inputMode="numeric" defaultValue={fp?.hourly_rate ?? ''} placeholder="85" className="field" /></div>
        <div><label className="field-label" htmlFor="sam_uei">SAM.gov UEI (if your business has one)</label><input id="sam_uei" name="sam_uei" maxLength={12} defaultValue={fp?.sam_uei ?? ''} className="field uppercase" /></div>
        <div className="flex flex-col gap-2 text-sm sm:col-span-2">
          <label className="flex items-center gap-2"><input type="checkbox" name="available" defaultChecked={fp?.available ?? true} className="accent-navy" />Available for new work</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="clearance_work" defaultChecked={fp?.clearance_work ?? false} className="accent-navy" />Open to cleared work (your clearance level comes from your main profile)</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="vosb" defaultChecked={fp?.vosb ?? false} className="accent-navy" />My business is a Veteran-Owned Small Business (VOSB)</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="sdvosb" defaultChecked={fp?.sdvosb ?? false} className="accent-navy" />My business is a Service-Disabled Veteran-Owned Small Business (SDVOSB)</label>
          <p className="text-xs text-muted">VOSB/SDVOSB are self-reported. Certified businesses should list their SAM.gov UEI so clients can confirm certification.</p>
        </div>
        <div className="sm:col-span-2"><SubmitButton className="btn btn-primary" pendingText="Saving…">{fp ? 'Save changes' : 'Create freelancer profile'}</SubmitButton></div>
      </form>

      <section id="payouts" className="card scroll-mt-24 p-7">
        <h2 className="font-serif text-2xl font-semibold">Payouts</h2>
        {payoutsReady ? (
          <p className="mt-2 text-sm text-olive">✓ Payouts are set up. Approved milestones are paid to your bank account through Stripe.</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">
              Payments go through Stripe, which verifies your identity and collects your tax and bank details directly — LanceNest never sees them. It takes about five minutes.
              {searchParams.payouts === 'done' && ' Stripe may take a few minutes to finish reviewing — refresh this page shortly.'}
            </p>
            <form action="/api/connect/onboard" method="post" className="mt-4"><button className="btn btn-brass" disabled={!fp}>{fp?.stripe_account_id ? 'Finish payout setup' : 'Set up payouts'}</button></form>
            {!fp && <p className="mt-2 text-xs text-muted">Create your freelancer profile first.</p>}
          </>
        )}
      </section>

      <section id="portfolio" className="card scroll-mt-24 p-7">
        <h2 className="font-serif text-2xl font-semibold">Portfolio</h2>
        <p className="mt-1 text-sm text-muted">Show real work — projects, results, and links. Clients hire from portfolios.</p>
        {(items ?? []).length > 0 && (
          <ul className="mt-5 divide-y divide-line rounded-[4px] border border-line">
            {(items ?? []).map((it) => (
              <li key={it.id as string} className="flex items-start justify-between gap-4 p-4">
                <div><p className="font-medium">{it.title as string}</p>{it.description && <p className="text-sm text-muted">{it.description as string}</p>}{it.url && <a href={it.url as string} target="_blank" rel="noopener noreferrer" className="text-xs text-navy underline">{it.url as string}</a>}</div>
                <form action={removePortfolioItem.bind(null, it.id as string)}><button className="text-xs text-muted hover:text-signal">Remove</button></form>
              </li>
            ))}
          </ul>
        )}
        {fp ? (
          <form action={addPortfolioItem} className="mt-5 grid gap-3 sm:grid-cols-2">
            <input name="title" required placeholder="Project title" className="field" />
            <input name="url" placeholder="Link (optional)" className="field" />
            <textarea name="description" rows={2} placeholder="What you did and the result" className="field sm:col-span-2" />
            <div><SubmitButton className="btn btn-outline" pendingText="Adding…">Add to portfolio</SubmitButton></div>
          </form>
        ) : <p className="mt-4 text-sm text-muted">Create your freelancer profile to add portfolio work.</p>}
      </section>
    </div>
  );
}
