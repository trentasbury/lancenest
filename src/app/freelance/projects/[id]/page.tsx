import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CLEARANCE_LABEL } from '@/lib/employer';
import { FREE_PROPOSALS_PER_MONTH, keepPercent, proposalsUsedThisMonth } from '@/lib/freelance';
import { timeAgo } from '@/lib/network';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import VerifiedMark from '@/components/VerifiedMark';
import Avatar from '@/components/network/Avatar';
import { startConversation } from '@/app/messages/actions';
import { setProjectStatus, setProposalStatus, submitProposal, withdrawProposal } from '../../actions';

export const metadata: Metadata = { title: 'Project' };
const ERR: Record<string, string> = { proposal: 'Add your price and a cover letter of at least 30 characters.', limit: `You’ve used your ${FREE_PROPOSALS_PER_MONTH} free proposals this month. Pro members send unlimited proposals.`, closed: 'This project is no longer accepting proposals.', duplicate: 'You’ve already sent a proposal for this project.', save: 'Your proposal didn’t send — please try again.', pii: 'That looks like a Social Security number. For your safety, LanceNest never allows SSNs to be shared — please remove it.' };

type Proposal = { id: string; freelancer_id: string; cover_letter: string; bid_amount: number; timeline: string | null; status: string; created_at: string;
  freelancer: { full_name: string; username: string | null; headline: string | null; verified: boolean; service_summary: string | null } | null };

export default async function ProjectPage({ params, searchParams }: { params: { id: string }; searchParams: { error?: string; sent?: string } }) {
  const { user, profile } = await requireVerifiedMember(`/freelance/projects/${params.id}`);
  const supabase = createClient();
  const { data: project } = await supabase.from('freelance_projects').select('*, company:companies(name, slug, is_verified)').eq('id', params.id).maybeSingle();
  if (!project) notFound();
  const isOwner = project.client_id === user.id;
  const isVet = profile.role === 'veteran';
  const company = project.company as { name: string; slug: string; is_verified: boolean } | null;

  const { data: proposalRows } = await supabase.from('proposals')
    .select('id, freelancer_id, cover_letter, bid_amount, timeline, status, created_at, freelancer:profiles!proposals_freelancer_id_fkey(full_name, username, headline, verified, service_summary)')
    .eq('project_id', project.id).order('created_at');
  const proposals = (proposalRows ?? []) as unknown as Proposal[];
  const mine = proposals.find((p) => p.freelancer_id === user.id);
  const [{ data: fp }, { data: vet }] = isVet
    ? await Promise.all([supabase.from('freelancer_profiles').select('title').eq('profile_id', user.id).maybeSingle(), supabase.from('veteran_profiles').select('plan').eq('profile_id', user.id).maybeSingle()])
    : [{ data: null }, { data: null }];
  const plan = (vet?.plan as string) ?? 'free';
  const used = isVet ? await proposalsUsedThisMonth(user.id) : 0;

  return (
    <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-6">
        <Link href="/freelance" className="text-sm text-muted hover:text-navy">← Freelance</Link>
        <div>
          <h1 className="font-serif text-4xl font-medium">{project.title}</h1>
          <p className="mt-2 text-sm text-muted">
            {company && <Link href={`/companies/${company.slug}`} className="text-navy underline">{company.name}</Link>}
            {company?.is_verified && <span className="ml-1 text-olive">✓ verified company</span>} · {project.category ?? 'General'} · posted {timeAgo(project.created_at)} · <span className="capitalize">{String(project.status).replace('_', ' ')}</span>
          </p>
          {project.clearance_required !== 'none' && <p className="mt-2 inline-block rounded-full border border-brass/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-brass-dark">{CLEARANCE_LABEL[project.clearance_required as string]} clearance required</p>}
        </div>
        <section className="card p-7"><h2 className="eyebrow">Scope of work</h2><p className="mt-3 whitespace-pre-line leading-relaxed">{project.description}</p></section>

        {isOwner && (
          <section className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="eyebrow">Proposals ({proposals.filter((p) => p.status !== 'withdrawn').length})</h2>
              <form action={setProjectStatus.bind(null, project.id, project.status === 'open' ? 'closed' : 'open')}><SubmitButton className="btn btn-ghost border border-line py-1.5 text-xs" pendingText="…">{project.status === 'open' ? 'Close to new proposals' : 'Reopen'}</SubmitButton></form>
            </div>
            {proposals.length === 0 && <p className="card p-6 text-sm text-muted">No proposals yet. Verified service members are notified as they browse — most projects get proposals within a few days.</p>}
            {proposals.filter((p) => p.status !== 'withdrawn').map((p) => (
              <div key={p.id} className={`card p-5 ${p.status === 'shortlisted' ? 'border-brass' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.freelancer?.full_name} />
                    <div>
                      <p className="font-medium">{p.freelancer?.username ? <Link href={`/veterans/${p.freelancer.username}`} className="hover:underline">{p.freelancer.full_name}</Link> : p.freelancer?.full_name}{p.freelancer?.verified && <VerifiedMark />}</p>
                      <p className="text-xs text-muted">{[p.freelancer?.headline, p.freelancer?.service_summary].filter(Boolean).join(' · ')}</p>
                    </div>
                  </div>
                  <p className="text-right"><span className="font-serif text-2xl text-navy">${p.bid_amount.toLocaleString()}</span>{p.timeline && <span className="block text-xs text-muted">{p.timeline}</span>}</p>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm text-ink/90">{p.cover_letter}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  <span className="text-xs capitalize text-muted">{p.status}</span>
                  {p.status !== 'shortlisted' && p.status !== 'declined' && <form action={setProposalStatus.bind(null, p.id, project.id, 'shortlisted')}><SubmitButton className="btn btn-outline py-1.5 text-xs" pendingText="…">Shortlist</SubmitButton></form>}
                  {p.status !== 'declined' && <form action={setProposalStatus.bind(null, p.id, project.id, 'declined')}><SubmitButton className="btn btn-ghost py-1.5 text-xs" pendingText="…">Decline</SubmitButton></form>}
                  <form action={startConversation.bind(null, p.freelancer_id)}><SubmitButton className="btn btn-primary py-1.5 text-xs" pendingText="…">Message</SubmitButton></form>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      <aside className="space-y-5">
        <div className="card p-6">
          <p className="eyebrow">Budget</p>
          <p className="mt-2 font-serif text-3xl text-navy">{project.budget_min || project.budget_max ? `$${(project.budget_min ?? project.budget_max).toLocaleString()}${project.budget_max && project.budget_min && project.budget_max !== project.budget_min ? `–$${project.budget_max.toLocaleString()}` : ''}` : 'Open'}{project.budget_type === 'hourly' ? '/hr' : ''}</p>
          <p className="text-xs text-muted">{project.budget_type === 'hourly' ? 'Hourly' : 'Fixed price'} · payments protected until you approve the work</p>
        </div>

        {isVet && (mine ? (
          <div className="card p-6">
            <p className="eyebrow">Your proposal</p>
            {searchParams.sent && <p className="mt-2 text-sm text-olive">Sent. The client has been notified.</p>}
            <p className="mt-2 font-serif text-2xl">${mine.bid_amount.toLocaleString()}</p>
            <p className="text-sm capitalize text-muted">Status: {mine.status}</p>
            {['submitted', 'shortlisted'].includes(mine.status) && <form action={withdrawProposal.bind(null, mine.id, project.id)} className="mt-3"><SubmitButton className="btn btn-ghost border border-line py-1.5 text-xs" pendingText="…">Withdraw</SubmitButton></form>}
          </div>
        ) : project.status !== 'open' ? (
          <div className="card p-6 text-sm text-muted">This project isn’t accepting proposals.</div>
        ) : !fp ? (
          <div className="card p-6"><p className="font-medium">Create your freelancer profile to send a proposal.</p><Link href="/freelance/profile" className="btn btn-primary mt-3">Set up profile</Link></div>
        ) : (
          <form action={submitProposal.bind(null, project.id)} className="card space-y-3 p-6">
            <p className="eyebrow">Send a proposal</p>
            {searchParams.error && <FormMessage error={ERR[searchParams.error] ?? ERR.save} />}
            <div><label className="field-label" htmlFor="bid_amount">Your price ($)</label><input id="bid_amount" name="bid_amount" required inputMode="numeric" className="field" /></div>
            <div><label className="field-label" htmlFor="timeline">Timeline</label><input id="timeline" name="timeline" placeholder="e.g. 3 weeks" className="field" /></div>
            <div><label className="field-label" htmlFor="cover_letter">Why you</label><textarea id="cover_letter" name="cover_letter" required rows={6} minLength={30} className="field" /></div>
            <p className="text-xs text-muted">You keep {keepPercent(plan)}% of payments on this project. {plan === 'free' ? `${Math.max(FREE_PROPOSALS_PER_MONTH - used, 0)} of ${FREE_PROPOSALS_PER_MONTH} free proposals left this month.` : 'Unlimited proposals.'}</p>
            <SubmitButton className="btn btn-primary w-full" pendingText="Sending…">Send proposal</SubmitButton>
          </form>
        ))}
      </aside>
    </div>
  );
}
