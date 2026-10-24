import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { ambassadorStatus } from '@/lib/ambassadors';
import { SITE } from '@/lib/email';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { applyAmbassador } from './actions';

export const metadata: Metadata = {
  title: 'LanceNest Ambassadors',
  description: 'Help service members on your base find their next job, and earn free months of LanceNest Pro for every verified member you bring.',
};

const RULES = [
  'Share your link where you’re allowed to: TAP classes and unit groups with the organizer’s OK, social media, friends and family.',
  'Don’t post flyers or hand out materials on an installation without the installation’s permission.',
  'Never ask people you supervise or rate to sign up, and never offer them anything for it.',
  'On active duty? This is an off-duty activity. Check with your ethics counselor if you’re unsure, and don’t use your rank, title or a government email to promote it.',
  'When you post about LanceNest, say you’re a LanceNest Ambassador (for example, add #LanceNestAmbassador), because you earn rewards for sign-ups.',
  'Rewards are LanceNest plan credit, not cash.',
];

export default async function AmbassadorsPage(props: { searchParams: Promise<{ applied?: string; error?: string }> }) {
  const sp = await props.searchParams;
  const session = await getSessionProfile();
  const isMember = session?.profile?.role === 'veteran';
  const status = isMember ? await ambassadorStatus(session!.user.id) : null;
  const active = status?.status === 'active';
  let stats: { joined: number; earned: number } | null = null;
  if (active) {
    const admin = createAdminClient();
    const [{ count: joined }, { count: earned }] = await Promise.all([
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('referred_by', session!.user.id),
      admin.from('referral_rewards').select('referred_id', { count: 'exact', head: true }).eq('referrer_id', session!.user.id),
    ]);
    stats = { joined: joined ?? 0, earned: earned ?? 0 };
  }
  const link = session?.profile?.username ? `${SITE}/signup?ref=${session.profile.username}` : null;

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page max-w-5xl py-14">
          <p className="eyebrow text-brass">Ambassadors</p>
          <h1 className="mt-3 max-w-3xl font-serif text-5xl font-medium text-ivory">Help the people on your base find what’s next.</h1>
          <p className="mt-4 max-w-2xl text-cream/80">LanceNest Ambassadors are verified service members and veterans who share LanceNest with people getting out. Every verified member who joins with your link earns you a free month of Pro, with no limit.</p>
        </div>
      </section>
      <div className="container-page grid max-w-5xl gap-10 py-12 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <section>
            <h2 className="font-serif text-2xl font-semibold">How it works</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-[15px] text-ink/85">
              <li>Apply below. We review every application by hand.</li>
              <li>Share your link and your printable flyer (it has your own QR code).</li>
              <li>When someone joins with your link and gets verified, you get a free month of Pro. On a paid plan, it’s a month’s credit instead.</li>
              <li>Bring in a company that becomes a paying customer and you get 2 months of Career Accelerator.</li>
            </ol>
          </section>
          <section>
            <h2 className="font-serif text-2xl font-semibold">Ambassador rules</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] text-ink/85">{RULES.map((r) => <li key={r}>{r}</li>)}</ul>
          </section>
        </div>
        <aside id="apply" className="scroll-mt-24">
          <div className="card space-y-4 p-6">
            {sp.applied && <FormMessage message="Thanks. We’ll review your application and let you know." />}
            {sp.error && <FormMessage error={sp.error === 'removed' ? 'Your ambassador status was ended. Contact us through Help if you think that’s a mistake.' : 'Add your base or city, and agree to the rules.'} />}
            {!session ? (
              <>
                <p className="font-semibold text-ink">Ambassadors are verified members.</p>
                <Link href="/signup?role=veteran" className="btn btn-primary w-full">Create a free profile</Link>
                <Link href="/login?next=/ambassadors" className="btn btn-outline w-full">Log in</Link>
              </>
            ) : !isMember ? (
              <p className="text-sm text-muted">The ambassador program is for service members and veterans.</p>
            ) : active ? (
              <>
                <p className="font-semibold text-olive">✓ You’re a LanceNest Ambassador</p>
                {link && <input readOnly value={link} className="field text-xs" aria-label="Your ambassador link" />}
                {stats && <p className="text-sm text-muted">{stats.joined} joined with your link · {stats.earned} rewards earned</p>}
                <Link href="/ambassadors/flyer" className="btn btn-primary w-full">Print your flyer</Link>
              </>
            ) : status?.status === 'pending' ? (
              <p className="text-sm text-muted">Your application ({status.installation}) is being reviewed.</p>
            ) : (
              <form action={applyAmbassador} className="space-y-3">
                <p className="font-semibold text-ink">Apply to be an ambassador</p>
                <div><label className="field-label" htmlFor="installation">Your base, unit area or city</label><input id="installation" name="installation" required maxLength={120} className="field" placeholder="e.g. Camp Lejeune, NC" /></div>
                <div><label className="field-label" htmlFor="role_note">How you’d share it <span className="font-normal text-muted">(optional)</span></label><textarea id="role_note" name="role_note" rows={3} maxLength={300} className="field" placeholder="e.g. I help run our unit’s transition group" /></div>
                <label className="flex items-start gap-2 text-xs text-ink/85"><input type="checkbox" name="rules" required className="mt-0.5 accent-navy" />I’ve read and will follow the ambassador rules.</label>
                <SubmitButton className="btn btn-primary w-full" pendingText="Sending…">Apply</SubmitButton>
              </form>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
