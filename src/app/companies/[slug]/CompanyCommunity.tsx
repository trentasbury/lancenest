import Link from 'next/link';
import SubmitButton from '@/components/SubmitButton';
import { startConversation } from '@/app/messages/actions';
import { reportContent } from '@/app/network/actions';
import { MIN_RATINGS, companyPeople, companyReviews, myRating, myWorkplace, ratingSummary } from '@/lib/workplaces';
import { addWorkplace, rateCompany, removeWorkplace, respondToRating } from './actions';

type Viewer = { id: string; role: string; verifiedMember: boolean; ownsCompany: boolean } | null;

const NOTICES: Record<string, string> = {
  saved: 'Saved. You’re listed as someone who works here.', limit: 'You can list up to 5 workplaces.', contact: 'Please leave out phone numbers, emails and links.',
  workplace: 'Add this company as a current or past workplace first, then rate it.', missing: 'Pick a score for both questions and whether you’d recommend it.',
  honest: 'Please confirm the rating is your own honest experience.', explicit: 'That includes language LanceNest doesn’t allow, such as sexual content or slurs. Please edit it.', error: 'That didn’t save. Please try again.', responded: 'Your reply is posted.',
};

function Stars({ n }: { n: number }) {
  return <span aria-label={`${n} out of 5`} className="tracking-tight text-brass">{'★'.repeat(Math.round(n))}<span className="text-line">{'★'.repeat(5 - Math.round(n))}</span></span>;
}

function Score({ name, label }: { name: string; label: string }) {
  return (
    <fieldset>
      <legend className="field-label">{label}</legend>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((v) => (
          <label key={v} className="flex cursor-pointer items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm has-[:checked]:border-brass has-[:checked]:bg-brass/10">
            <input type="radio" name={name} value={v} required className="sr-only" />{v}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** "Veterans who work here" and "Rated by verified veterans" on a company page. */
export default async function CompanyCommunity({ company, viewer, work, rate }: { company: { id: string; slug: string; name: string }; viewer: Viewer; work?: string; rate?: string }) {
  const member = !!viewer && viewer.verifiedMember && (viewer.role === 'veteran' || viewer.role === 'admin');
  const [{ count, people }, summary, mine] = await Promise.all([
    companyPeople(company.id, member),
    ratingSummary(company.id),
    member && viewer ? myWorkplace(viewer.id, company.id) : Promise.resolve(null),
  ]);
  const canReadReviews = (member || !!viewer?.ownsCompany) && (summary?.count ?? 0) >= MIN_RATINGS;
  const [reviews, myOwn] = await Promise.all([
    canReadReviews ? companyReviews(company.id) : Promise.resolve([]),
    member && viewer && mine ? myRating(viewer.id, company.id) : Promise.resolve(null),
  ]);
  const others = people.filter((p) => p.id !== viewer?.id);

  return (
    <>
      <section id="people" className="scroll-mt-24">
        <p className="eyebrow">Veterans who work here</p>
        {work && NOTICES[work] && <p className="mt-3 rounded-lg bg-olive/10 px-4 py-2 text-sm text-olive">{NOTICES[work]}</p>}
        <p className="mt-3 text-sm text-muted">
          {count === 0 ? `No verified members list ${company.name} as a workplace yet.` : `${count} verified member${count === 1 ? '' : 's'} list${count === 1 ? 's' : ''} ${company.name} as a current or past workplace.`}
          {!member && count > 0 && <> <Link href={`/signup?role=veteran`} className="text-navy underline">Join free</Link> to see who and ask for a referral.</>}
        </p>
        {member && others.length > 0 && (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {others.map((p) => (
              <li key={p.id} className="card flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  {p.username ? <Link href={`/veterans/${p.username}`} className="font-medium text-navy hover:underline">{p.full_name}</Link> : <span className="font-medium">{p.full_name}</span>}
                  <p className="truncate text-xs text-muted">{[p.title ?? p.headline, p.is_current ? 'Works here now' : 'Used to work here'].filter(Boolean).join(' · ')}</p>
                </div>
                {p.open_to_referrals && p.is_current && (
                  <form action={startConversation.bind(null, p.id)}>
                    <input type="hidden" name="draft" value={`Hi ${p.full_name.split(' ')[0]}, I saw on LanceNest that you work at ${company.name}. I’m interested in a role there. Would you be open to a quick chat, or a referral if it’s a fit?`} />
                    <SubmitButton className="btn btn-outline shrink-0 px-3 py-1.5 text-xs" pendingText="…">Ask for a referral</SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        {member && viewer?.role === 'veteran' && (
          mine ? (
            <form action={removeWorkplace.bind(null, company.slug)} className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted">
              <span>✓ You’re listed here{mine.title ? ` as ${mine.title}` : ''}{mine.open_to_referrals ? ', open to referral requests' : ''}.</span>
              <SubmitButton className="text-navy underline" pendingText="…">Remove me</SubmitButton>
            </form>
          ) : (
            <details className="card mt-4 p-4 text-sm">
              <summary className="cursor-pointer font-medium text-navy">Do you work here, or used to? Add it</summary>
              <form action={addWorkplace.bind(null, company.slug)} className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><label className="field-label" htmlFor="title">Your title <span className="font-normal text-muted">(optional)</span></label><input id="title" name="title" maxLength={120} className="field" /></div>
                <label className="flex items-center gap-2"><input type="radio" name="is_current" value="current" defaultChecked className="accent-navy" />I work here now</label>
                <label className="flex items-center gap-2"><input type="radio" name="is_current" value="past" className="accent-navy" />I used to work here</label>
                <label className="flex items-start gap-2 sm:col-span-2"><input type="checkbox" name="open_to_referrals" defaultChecked className="mt-0.5 accent-navy" />Other verified members can message me for a referral</label>
                <p className="text-xs text-muted sm:col-span-2">Verified members can see your name here. Employers see only the count.</p>
                <SubmitButton className="btn btn-primary sm:col-span-2" pendingText="Saving…">Add workplace</SubmitButton>
              </form>
            </details>
          )
        )}
      </section>

      <section id="ratings" className="scroll-mt-24">
        <p className="eyebrow">Rated by verified veterans</p>
        {rate && NOTICES[rate] && <p className="mt-3 rounded-lg bg-olive/10 px-4 py-2 text-sm text-olive">{rate === 'saved' ? 'Thanks. Your rating is saved. The employer never sees who wrote it.' : NOTICES[rate]}</p>}
        {!summary ? (
          <p className="mt-3 text-sm text-muted">No ratings yet. Verified members who work or worked here can rate how veteran-friendly it is.</p>
        ) : summary.count < MIN_RATINGS ? (
          <p className="mt-3 text-sm text-muted">{summary.count} rating{summary.count === 1 ? '' : 's'} so far. Scores appear once {MIN_RATINGS} verified members have rated {company.name}, so no one can be identified.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="card p-4"><p className="text-xs uppercase tracking-[0.12em] text-muted">Overall</p><p className="mt-1 font-serif text-3xl text-navy">{summary.overall.toFixed(1)}</p><Stars n={summary.overall} /></div>
            <div className="card p-4"><p className="text-xs uppercase tracking-[0.12em] text-muted">Support for veterans</p><p className="mt-1 font-serif text-3xl text-navy">{summary.veteranSupport.toFixed(1)}</p><Stars n={summary.veteranSupport} /></div>
            <div className="card p-4"><p className="text-xs uppercase tracking-[0.12em] text-muted">Would recommend</p><p className="mt-1 font-serif text-3xl text-navy">{summary.recommendPct}%</p><p className="text-xs text-muted">{summary.count} verified ratings</p></div>
          </div>
        )}
        {reviews.length > 0 && (
          <ul className="mt-4 space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="card p-4 text-sm">
                <p className="flex flex-wrap items-center gap-2"><Stars n={r.overall} /><span className="text-xs text-muted">{r.was_current ? 'Current employee' : 'Former employee'} · verified veteran · {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span></p>
                {r.pros && <p className="mt-2"><span className="font-semibold text-olive">Good: </span>{r.pros}</p>}
                {r.cons && <p className="mt-1"><span className="font-semibold text-signal">Could be better: </span>{r.cons}</p>}
                {r.employer_response && <p className="mt-2 rounded-lg bg-paper p-3 text-ink/85"><span className="font-semibold">{company.name} replied: </span>{r.employer_response}</p>}
                {viewer?.ownsCompany && (
                  <details className="mt-2"><summary className="cursor-pointer text-xs text-navy">{r.employer_response ? 'Edit your reply' : 'Reply publicly'}</summary>
                    <form action={respondToRating.bind(null, company.slug, r.id)} className="mt-2 space-y-2">
                      <textarea name="response" maxLength={1000} rows={3} defaultValue={r.employer_response ?? ''} className="field" />
                      <SubmitButton className="btn btn-outline py-1.5" pendingText="Posting…">Post reply</SubmitButton>
                    </form>
                  </details>
                )}
                {member && (
                  <details className="mt-2 text-xs text-muted"><summary className="cursor-pointer hover:text-signal">Report this rating</summary>
                    <form action={reportContent.bind(null, 'rating', r.id)} data-close data-reset data-done="Thanks. We’ll review this rating." className="mt-2 flex gap-2">
                      <select name="reason" required defaultValue="" className="field py-1.5 text-xs"><option value="" disabled>Reason…</option><option value="fake_information">False or not a real employee</option><option value="harassment">Harassment or personal attack</option><option value="sensitive_info">Shares private or sensitive info</option><option value="other">Other</option></select>
                      <SubmitButton className="btn btn-outline py-1.5 text-xs" pendingText="…">Report</SubmitButton>
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
        {member && viewer?.role === 'veteran' && mine && (
          <details className="card mt-4 p-4 text-sm" open={!!rate && rate !== 'saved'}>
            <summary className="cursor-pointer font-medium text-navy">{myOwn ? 'Update your rating' : `Rate ${company.name}`}</summary>
            <form action={rateCompany.bind(null, company.slug)} className="mt-3 space-y-4">
              <Score name="overall" label="Overall, how is it to work here?" />
              <Score name="veteran_support" label="How well do they support veterans (hiring, culture, Guard/Reserve duty, transition)?" />
              <fieldset><legend className="field-label">Would you recommend it to another veteran?</legend>
                <div className="flex gap-4"><label className="flex items-center gap-2"><input type="radio" name="recommend" value="yes" required className="accent-navy" />Yes</label><label className="flex items-center gap-2"><input type="radio" name="recommend" value="no" className="accent-navy" />No</label></div>
              </fieldset>
              <div><label className="field-label" htmlFor="pros">What’s good <span className="font-normal text-muted">(optional)</span></label><textarea id="pros" name="pros" maxLength={1000} rows={2} defaultValue={myOwn?.pros ?? ''} className="field" /></div>
              <div><label className="field-label" htmlFor="cons">What could be better <span className="font-normal text-muted">(optional)</span></label><textarea id="cons" name="cons" maxLength={1000} rows={2} defaultValue={myOwn?.cons ?? ''} className="field" /></div>
              <label className="flex items-start gap-2 text-xs text-ink/85"><input type="checkbox" name="honest" required className="mt-0.5 accent-navy" />This is my own honest experience. It names no individuals and shares nothing confidential or classified.</label>
              <p className="text-xs text-muted">Your name is never shown with your rating, and the employer can’t see who wrote it.</p>
              <SubmitButton className="btn btn-primary" pendingText="Saving…">Save rating</SubmitButton>
            </form>
          </details>
        )}
      </section>
    </>
  );
}
