import type { Metadata } from 'next';
import Link from 'next/link';
import { requireVerifiedMember } from '@/lib/auth';
import { EXPLICIT_BLOCKED, CONTACT_BLOCKED } from '@/lib/contact';
import { GROUP_CATEGORIES } from '@/lib/groups';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { createGroup } from '../actions';

export const metadata: Metadata = { title: 'Start a group' };

const ERR: Record<string, string> = {
  guidelines: 'Please agree to the group guidelines.',
  name: 'Give the group a name (at least 3 characters).',
  category: 'Pick what kind of group this is.',
  description: 'Add a short description (at least 10 characters) so members know what it’s about.',
  purpose: 'Tell us why you’re starting it (at least 20 characters). Only LanceNest’s team sees this.',
  reserved: 'Group names can’t include words like “Official”, “LanceNest”, “Admin”, “Moderator” or “Staff”, so no group looks like it’s run by LanceNest.',
  taken: 'There’s already a group with that name. Try making it more specific (add a unit, a year, or a place).',
  waiting: 'You have two groups waiting for review. We’ll get to them soon.',
  limit: 'You’ve started three groups in the last 30 days. Please try again later.',
  screen: `${EXPLICIT_BLOCKED} ${CONTACT_BLOCKED}`,
  failed: 'That didn’t go through. Please try again.',
};

export default async function NewGroupPage(props: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await props.searchParams;
  const { profile } = await requireVerifiedMember('/groups/new');
  const canStart = profile.role === 'veteran' || profile.role === 'admin';

  return (
    <div className="container-page max-w-2xl space-y-6 py-10">
      <Link href="/groups" className="text-sm text-muted hover:text-navy">← Groups</Link>
      <div>
        <h1 className="font-serif text-4xl font-medium">Start a group</h1>
        <p className="mt-2 text-muted">
          Bring your people together: the guys from your unit, a faith fellowship, spouses at your base, friends from boot camp,
          or anyone who shares something with you. Every group is reviewed by LanceNest before it goes live, usually within two business days.
        </p>
      </div>

      {!canStart ? (
        <div className="card p-6 text-sm text-muted">Groups are started by verified service members, veterans and military spouses. Company accounts can join groups but can’t start them.</div>
      ) : (
        <form action={createGroup} className="card space-y-5 p-6">
          {error && <FormMessage error={ERR[error] ?? ERR.failed} />}

          <div>
            <label htmlFor="name" className="field-label">Group name</label>
            <input id="name" name="name" required minLength={3} maxLength={80} className="field" placeholder="e.g. 3rd Battalion, 7th Marines (2005–2010)" />
          </div>

          <fieldset>
            <legend className="field-label">What kind of group?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {GROUP_CATEGORIES.map((c, i) => (
                <label key={c.value} className="flex cursor-pointer items-start gap-2 rounded-lg border border-line p-3 text-sm has-[:checked]:border-navy has-[:checked]:bg-navy/5">
                  <input type="radio" name="category" value={c.value} required defaultChecked={i === 0} className="mt-0.5" />
                  <span><span className="font-medium text-ink">{c.label}</span>{c.example && <span className="block text-xs text-muted">e.g. {c.example}</span>}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="field-label">Who can see posts?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line p-3 text-sm has-[:checked]:border-navy has-[:checked]:bg-navy/5">
                <input type="radio" name="privacy" value="open" defaultChecked className="mt-0.5" />
                <span><span className="font-medium text-ink">Open</span><span className="block text-xs text-muted">Any verified member can join and read posts.</span></span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line p-3 text-sm has-[:checked]:border-navy has-[:checked]:bg-navy/5">
                <input type="radio" name="privacy" value="private" className="mt-0.5" />
                <span><span className="font-medium text-ink">Private</span><span className="block text-xs text-muted">Members ask to join and you approve them. Only members see posts and who’s in it.</span></span>
              </label>
            </div>
          </fieldset>

          <div>
            <label htmlFor="description" className="field-label">Description (members see this)</label>
            <textarea id="description" name="description" required minLength={10} maxLength={500} rows={3} className="field"
              placeholder="Who it’s for and what you’ll talk about. e.g. A place for Marines who served with 3/7 to stay in touch, share job leads and plan reunions." />
          </div>

          <div>
            <label htmlFor="purpose" className="field-label">Why are you starting it? (only LanceNest sees this)</label>
            <textarea id="purpose" name="purpose" required minLength={20} maxLength={1000} rows={4} className="field"
              placeholder="Tell us a little about the group and how you’re connected to it. e.g. I served with 3/7 from 2006 to 2010 and about 20 of us are already on LanceNest." />
          </div>

          <div className="rounded-lg border border-line bg-paper p-4 text-sm text-muted">
            <p className="font-semibold text-ink">Group guidelines</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Groups are run by members. They aren’t official and aren’t affiliated with or endorsed by the Department of Defense, any branch, unit, or LanceNest.</li>
              <li>OPSEC first: no classified information, current locations, deployments, or troop movements. Unit groups are for people who served together, not for current operations.</li>
              <li>The LanceNest Code of Conduct applies: no harassment, hate, or explicit content, and no selling, fundraising, or taking work or payment off LanceNest.</li>
              <li>As the owner you’ll approve requests (for private groups), name moderators, and remove posts or members that break the rules. LanceNest can step in, suspend, or close any group.</li>
            </ul>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="guidelines" required className="mt-1" />
            <span>I’ll run this group by the guidelines above and the <Link href="/conduct" className="text-navy underline">Code of Conduct</Link>.</span>
          </label>

          <SubmitButton pendingText="Sending…">Send for review</SubmitButton>
        </form>
      )}
    </div>
  );
}
