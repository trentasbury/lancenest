import type { Metadata } from 'next';
import Link from 'next/link';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { OFFICIAL, transitionTimeline } from '@/lib/transition';
import JobCard from '@/components/JobCard';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import type { JobWithCompany } from '@/lib/types';
import { saveTransition } from './actions';

export const metadata: Metadata = { title: 'Transition Hub' };
const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const STEPS = [
  ['Get your separation or retirement date approved', 'SkillBridge requires an approved date on file.'],
  ['Complete TAP (SFL-TAP for Army)', 'Most branches require transition classes before SkillBridge approval.'],
  ['Pick a DoD-authorized SkillBridge program', 'Only organizations on skillbridge.osd.mil qualify. Every SkillBridge listing on LanceNest is from one.'],
  ['Get written approval from your first O-4 commander', 'Ask early — about 6–12 months out. Approval is at the command’s discretion.'],
  ['Start up to 180 days before separation', 'You keep full military pay, BAH, and benefits. The company does not pay you.'],
];

export default async function TransitionPage({ searchParams }: { searchParams: { saved?: string } }) {
  const { user, profile } = await requireVerifiedMember('/transition');
  const supabase = createClient();
  const [{ data: vet }, { data: sb }, { data: partners }] = await Promise.all([
    profile.role === 'veteran' ? supabase.from('veteran_profiles').select('separation_date, open_to_transition_hiring, skillbridge_interest').eq('profile_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('jobs').select('*, company:companies(name, slug, logo_url, is_verified, industry)').eq('status', 'open').eq('employment_type', 'skillbridge').order('posted_at', { ascending: false }).limit(20),
    supabase.from('companies').select('name, slug').eq('skillbridge_status', 'authorized').order('name').limit(40),
  ]);
  const tl = transitionTimeline((vet?.separation_date as string) ?? null);

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page py-10">
          <p className="eyebrow text-brass">Transition Hub</p>
          <h1 className="mt-2 font-serif text-4xl font-medium text-ivory sm:text-5xl">Your next mission starts before you separate.</h1>
          <p className="mt-2 max-w-2xl text-cream/80">Plan your transition, find DoD-authorized SkillBridge programs, and get seen by employers hiring members on their way out.</p>
        </div>
      </section>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-8">
          {tl && (
            <section className="card border-brass p-7">
              <p className="eyebrow">Your timeline</p>
              {tl.phase === 'separated' ? <p className="mt-2 font-serif text-2xl">Welcome to the civilian side. Your veteran benefits and job search start here.</p> : (
                <>
                  <p className="mt-2 font-serif text-3xl text-navy">{tl.days} days until {fmt(tl.sep)}</p>
                  <p className="mt-2 text-sm">
                    {tl.phase === 'window_open'
                      ? <span className="font-semibold text-olive">Your SkillBridge window is open now (it opened {fmt(tl.windowOpens)}).</span>
                      : <>Your SkillBridge window opens <strong>{fmt(tl.windowOpens)}</strong>. {tl.phase === 'plan_now' ? 'Request command approval now.' : 'Start researching programs and talking to your command.'}</>}
                  </p>
                </>
              )}
            </section>
          )}

          <section>
            <p className="eyebrow">SkillBridge approval, step by step</p>
            <ol className="mt-4 space-y-3">
              {STEPS.map(([title, body], i) => (
                <li key={title} className="card flex gap-4 p-5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy font-serif text-brass">{i + 1}</span>
                  <div><p className="font-medium">{title}</p><p className="text-sm text-muted">{body}</p></div>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <div className="flex items-end justify-between"><p className="eyebrow">SkillBridge programs on LanceNest</p><a href={OFFICIAL.skillbridge} target="_blank" rel="noopener noreferrer" className="text-sm text-navy underline">Official DoD directory ↗</a></div>
            {(sb ?? []).length === 0 ? (
              <p className="card mt-3 p-6 text-sm text-muted">No SkillBridge programs listed yet. Authorized companies are being onboarded — check the official DoD directory in the meantime.</p>
            ) : <div className="mt-3 space-y-3">{((sb ?? []) as JobWithCompany[]).map((j) => <JobCard key={j.id} job={j} />)}</div>}
          </section>
        </div>

        <aside className="space-y-5">
          {profile.role === 'veteran' && (
            <form action={saveTransition} className="card space-y-4 p-6">
              <p className="eyebrow">Your transition</p>
              {searchParams.saved && <FormMessage message="Saved." />}
              <div><label className="field-label" htmlFor="separation_date">Separation / retirement date</label><input id="separation_date" name="separation_date" type="date" defaultValue={(vet?.separation_date as string) ?? ''} className="field" /></div>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="open_to_transition_hiring" defaultChecked={!!vet?.open_to_transition_hiring} className="mt-0.5 accent-navy" />Show me to verified employers hiring transitioning members</label>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="skillbridge_interest" defaultChecked={!!vet?.skillbridge_interest} className="mt-0.5 accent-navy" />I’m interested in SkillBridge</label>
              <p className="text-xs text-muted">Employers see only your separation month — never your exact date.</p>
              <SubmitButton className="btn btn-primary w-full" pendingText="Saving…">Save</SubmitButton>
            </form>
          )}
          {(partners ?? []).length > 0 && (
            <div className="card p-6">
              <p className="eyebrow">Authorized SkillBridge employers</p>
              <ul className="mt-3 space-y-1.5 text-sm">{(partners ?? []).map((c) => <li key={c.slug as string}><Link href={`/companies/${c.slug}`} className="text-navy hover:underline">{c.name as string}</Link></li>)}</ul>
            </div>
          )}
          <div className="card p-6 text-sm">
            <p className="eyebrow">Official resources</p>
            <ul className="mt-3 space-y-2">
              <li><a href={OFFICIAL.skillbridge} target="_blank" rel="noopener noreferrer" className="text-navy underline">DoD SkillBridge ↗</a></li>
              <li><a href={OFFICIAL.tap} target="_blank" rel="noopener noreferrer" className="text-navy underline">Transition Assistance Program (TAP) ↗</a></li>
              <li><a href={OFFICIAL.vaBenefits} target="_blank" rel="noopener noreferrer" className="text-navy underline">VA benefits ↗</a></li>
              <li><a href={OFFICIAL.giBill} target="_blank" rel="noopener noreferrer" className="text-navy underline">GI Bill comparison tool ↗</a></li>
            </ul>
            <p className="mt-3 text-xs text-muted">LanceNest isn’t affiliated with DoD. SkillBridge approval always comes from your command.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
