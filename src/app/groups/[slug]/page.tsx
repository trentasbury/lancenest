import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EXPLICIT_BLOCKED, CONTACT_BLOCKED } from '@/lib/contact';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getFeed } from '@/lib/network';
import { GROUP_COLUMNS, categoryLabel, groupCounts, type GroupRow } from '@/lib/groups';
import PostCard from '@/components/network/PostCard';
import Avatar from '@/components/network/Avatar';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import {
  decideJoinRequest, hideGroupPost, joinGroup, leaveGroup, postInGroup, removeGroupMember, setGroupRole, updateGroupAbout,
} from '../actions';

export const metadata: Metadata = { title: 'Group' };

const ERR: Record<string, string> = {
  explicit: EXPLICIT_BLOCKED, join: 'Join the group to post.', pii: 'Posts can’t include Social Security numbers.',
  empty: 'Write something first.', post: 'That didn’t post. Please try again.',
  note: `Your note couldn’t be sent. ${CONTACT_BLOCKED}`, screen: `${EXPLICIT_BLOCKED} ${CONTACT_BLOCKED}`,
  closed: 'This group isn’t taking new members right now.', join_failed: 'That didn’t go through. Please try again.',
  owner: 'You own this group. Make someone else the owner first (from the member list), then you can leave.',
  not_manager: 'Only the group’s owner and moderators can do that.', not_allowed: 'That change isn’t allowed.',
  self: 'You can’t remove yourself here. Use “Leave group”.', mods: 'A group can have up to 10 moderators.',
  description: 'Add a description of at least 10 characters.',
};

type Member = {
  profile_id: string; role: string; status: string; request_note: string | null; created_at: string;
  profile: { full_name: string; username: string | null; headline: string | null; avatar_url: string | null; role: string } | null;
};
const PROFILE = 'profile:profiles!group_members_profile_id_fkey(full_name, username, headline, avatar_url, role)';

function Person({ m }: { m: Member }) {
  const name = m.profile?.full_name ?? 'Member';
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={name} src={m.profile?.avatar_url} size="sm" />
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">
          {m.profile?.role === 'veteran' && m.profile.username ? <Link href={`/veterans/${m.profile.username}`} className="hover:underline">{name}</Link> : name}
          {m.role !== 'member' && <span className="ml-2 rounded-full bg-brass/15 px-2 py-0.5 text-[11px] font-semibold text-brass-dark">{m.role === 'owner' ? 'Owner' : 'Moderator'}</span>}
        </span>
        {m.profile?.headline && <span className="block truncate text-xs text-muted">{m.profile.headline}</span>}
      </span>
    </span>
  );
}

export default async function GroupPage(
  props: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string; saved?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const { user, profile } = await requireVerifiedMember(`/groups/${params.slug}`);
  const supabase = await createClient();
  const { data: row } = await supabase.from('groups').select(GROUP_COLUMNS).eq('slug', params.slug).maybeSingle();
  if (!row) notFound();
  const g = row as GroupRow;
  const isAdmin = profile.role === 'admin';

  // Waiting for review, or not approved: only the starter (and LanceNest) can open it.
  if (g.status !== 'approved') {
    return (
      <div className="container-page max-w-3xl space-y-4 py-10">
        <Link href="/groups" className="text-sm text-muted hover:text-navy">← Groups</Link>
        <h1 className="font-serif text-4xl font-medium">{g.name}</h1>
        <p className="card p-6 text-sm text-muted">
          {g.status === 'pending' ? 'This group is waiting for review by LanceNest. You’ll get a notification when it’s approved, and you’ll be its owner.'
            : g.status === 'rejected' ? 'This group wasn’t approved. See the note on the Groups page.' : 'This group has been closed.'}
          {isAdmin && <> <Link href="/admin/groups" className="text-navy underline">Review it in Admin</Link>.</>}
        </p>
      </div>
    );
  }

  const { data: meRow } = await supabase.from('group_members').select('role, status').eq('group_id', g.id).eq('profile_id', user.id).maybeSingle();
  const active = meRow?.status === 'active';
  const pending = meRow?.status === 'pending';
  const memberGroup = !g.kind;
  const myRole = isAdmin && memberGroup ? 'owner' : active ? (meRow!.role as string) : null;
  const manager = memberGroup && (myRole === 'owner' || myRole === 'moderator');
  const canRead = isAdmin || active || g.privacy === 'open';

  const [counts, feed, { data: memberRows }] = await Promise.all([
    groupCounts(supabase, [g.id]),
    canRead ? getFeed({ viewerId: user.id, scope: 'everyone', groupId: g.id }) : Promise.resolve({ posts: [], nextCursor: null }),
    // Managers see everyone, including requests and notes; others see what their access allows.
    (manager ? createAdminClient() : supabase).from('group_members').select(`profile_id, role, status, request_note, created_at, ${PROFILE}`)
      .eq('group_id', g.id).order('created_at').limit(300),
  ]);
  const members = ((memberRows ?? []) as unknown as Member[]);
  const activeMembers = members.filter((m) => m.status === 'active').sort((a, b) => ['owner', 'moderator', 'member'].indexOf(a.role) - ['owner', 'moderator', 'member'].indexOf(b.role));
  const requests = manager ? members.filter((m) => m.status === 'pending') : [];
  const owner = activeMembers.find((m) => m.role === 'owner');
  const count = counts.get(g.id) ?? 0;

  return (
    <div className="container-page grid max-w-5xl items-start gap-6 py-10 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-6">
        <Link href="/groups" className="text-sm text-muted hover:text-navy">← Groups</Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">{g.kind ? 'LanceNest group' : categoryLabel(g.category) ?? 'Member group'}{g.privacy === 'private' ? ' · Private' : ''}</p>
            <h1 className="mt-1 font-serif text-4xl font-medium">{g.name}</h1>
            <p className="mt-1 text-muted">{count} member{count === 1 ? '' : 's'}{owner?.profile && memberGroup ? ` · Started by ${owner.profile.full_name}` : ''}</p>
          </div>
          {active ? (
            <form action={leaveGroup.bind(null, g.id, g.slug)}><button className="text-sm text-muted hover:text-signal">Leave group</button></form>
          ) : pending ? (
            <form action={leaveGroup.bind(null, g.id, g.slug)} className="text-right text-sm text-muted">Request sent. <button className="underline hover:text-signal">Cancel</button></form>
          ) : g.privacy === 'open' ? (
            <form action={joinGroup.bind(null, g.id, g.slug)}><SubmitButton className="btn btn-primary" pendingText="…">Join group</SubmitButton></form>
          ) : null}
        </div>

        {searchParams.error && <FormMessage error={ERR[searchParams.error] ?? ERR.post} />}
        {searchParams.saved && <FormMessage message="Saved." />}

        {!active && !pending && g.privacy === 'private' && (
          <form action={joinGroup.bind(null, g.id, g.slug)} className="card space-y-3 p-5">
            <p className="text-sm text-ink">This is a private group. Members approve who joins, and only members can see posts.</p>
            <label htmlFor="note" className="field-label">Note to the group (optional)</label>
            <textarea id="note" name="note" rows={2} maxLength={300} className="field" placeholder="How you’re connected, e.g. “I was in Bravo Company 2009–2012.”" />
            <SubmitButton className="btn btn-primary" pendingText="Sending…">Ask to join</SubmitButton>
          </form>
        )}

        {active && (
          <form action={postInGroup.bind(null, g.id, g.slug)} className="card space-y-3 p-5">
            <textarea name="body" required rows={3} maxLength={3000} placeholder={`Share with ${g.name}…`} className="field" />
            <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted">OPSEC: no classified information, locations, or movements.</p><SubmitButton className="btn btn-primary" pendingText="Posting…">Post</SubmitButton></div>
          </form>
        )}

        {!canRead ? <p className="card p-8 text-center text-muted">Posts in this group are for members only.</p>
          : feed.posts.length === 0 ? <p className="card p-8 text-center text-muted">No posts yet. Start the conversation.</p>
          : feed.posts.map((post) => (
            <div key={post.id}>
              <PostCard post={post} signedIn />
              {manager && post.author_id !== user.id && (
                <form action={hideGroupPost.bind(null, g.id, g.slug, post.id)} className="mt-1 text-right">
                  <button className="text-xs text-muted hover:text-signal">Hide from group</button>
                </form>
              )}
            </div>
          ))}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-[92px]">
        <div className="card space-y-3 p-5 text-sm">
          <p className="font-semibold text-ink">About</p>
          {g.description && <p className="whitespace-pre-line text-muted">{g.description}</p>}
          {memberGroup && <p className="text-xs text-muted">Run by members. Not affiliated with or endorsed by the Department of Defense, any branch or unit, or LanceNest. The <Link href="/conduct" className="underline">Code of Conduct</Link> applies.</p>}
        </div>

        {manager && myRole === 'owner' && (
          <details className="card p-5 text-sm">
            <summary className="cursor-pointer font-semibold text-ink">Edit group</summary>
            <form action={updateGroupAbout.bind(null, g.id, g.slug)} className="mt-3 space-y-3">
              <label htmlFor="description" className="field-label">Description</label>
              <textarea id="description" name="description" rows={4} minLength={10} maxLength={500} defaultValue={g.description ?? ''} className="field" />
              <label className="flex items-center gap-2"><input type="radio" name="privacy" value="open" defaultChecked={g.privacy === 'open'} /> Open</label>
              <label className="flex items-center gap-2"><input type="radio" name="privacy" value="private" defaultChecked={g.privacy === 'private'} /> Private</label>
              <p className="text-xs text-muted">To rename the group, message LanceNest support.</p>
              <SubmitButton className="btn btn-outline w-full" pendingText="Saving…">Save</SubmitButton>
            </form>
          </details>
        )}

        {manager && (
          <div id="requests" className="card scroll-mt-24 p-5 text-sm">
            <p className="font-semibold text-ink">Requests to join {requests.length > 0 && <span className="text-brass-dark">({requests.length})</span>}</p>
            {requests.length === 0 ? <p className="mt-2 text-xs text-muted">No one is waiting.</p> : (
              <ul className="mt-3 space-y-4">
                {requests.map((m) => (
                  <li key={m.profile_id} className="space-y-2">
                    <Person m={m} />
                    {m.request_note && <p className="rounded-lg bg-paper p-2 text-xs text-muted">“{m.request_note}”</p>}
                    <div className="flex gap-2">
                      <form action={decideJoinRequest.bind(null, g.id, g.slug, m.profile_id, 'approve')}><SubmitButton className="btn btn-primary px-3 py-1.5 text-xs" pendingText="…">Approve</SubmitButton></form>
                      <form action={decideJoinRequest.bind(null, g.id, g.slug, m.profile_id, 'decline')}><SubmitButton className="btn btn-ghost px-3 py-1.5 text-xs" pendingText="…">Decline</SubmitButton></form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {canRead && (
          <div className="card p-5 text-sm">
            <p className="font-semibold text-ink">Members</p>
            <ul className="mt-3 space-y-3">
              {activeMembers.slice(0, manager ? 300 : 24).map((m) => (
                <li key={m.profile_id} className="space-y-1">
                  <Person m={m} />
                  {manager && m.profile_id !== user.id && m.role !== 'owner' && (
                    <details className="pl-11 text-xs">
                      <summary className="cursor-pointer text-muted hover:text-navy">Manage</summary>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {myRole === 'owner' && m.role === 'member' && <form action={setGroupRole.bind(null, g.id, g.slug, m.profile_id, 'moderator')}><button className="text-navy underline">Make moderator</button></form>}
                        {myRole === 'owner' && m.role === 'moderator' && <form action={setGroupRole.bind(null, g.id, g.slug, m.profile_id, 'member')}><button className="text-navy underline">Remove as moderator</button></form>}
                        {myRole === 'owner' && <form action={setGroupRole.bind(null, g.id, g.slug, m.profile_id, 'owner')}><button className="text-navy underline">Hand off ownership</button></form>}
                        {(myRole === 'owner' || m.role === 'member') && <form action={removeGroupMember.bind(null, g.id, g.slug, m.profile_id)}><button className="text-signal underline">Remove from group</button></form>}
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ul>
            {!manager && activeMembers.length > 24 && <p className="mt-3 text-xs text-muted">and {count - 24} more</p>}
          </div>
        )}
      </aside>
    </div>
  );
}
