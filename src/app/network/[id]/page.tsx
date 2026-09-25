import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { REACTIONS, getPost, timeAgo } from '@/lib/network';
import PostCard from '@/components/network/PostCard';
import Avatar from '@/components/network/Avatar';
import SubmitButton from '@/components/SubmitButton';
import { addComment, deleteComment, reportContent, updateComment } from '../actions';

type Comment = {
  id: string; post_id: string; author_id: string; parent_id: string | null; body: string; edited_at: string | null; created_at: string;
  author: { full_name: string; username: string | null; role: string; verified: boolean } | null;
};

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const session = await getSessionProfile();
  const post = await getPost(params.id, session?.user.id ?? null);
  if (!post) return { title: 'Post not found', robots: { index: false } };
  return { title: `${post.author?.full_name ?? 'A member'}: ${post.headline ?? post.body.slice(0, 60)}`, robots: post.visibility === 'public' ? undefined : { index: false } };
}

function CommentItem({ c, me, postAuthorId, postId, replies }: { c: Comment; me: string | null; postAuthorId: string; postId: string; replies?: Comment[] }) {
  const mine = me === c.author_id;
  const canDelete = mine || me === postAuthorId;
  return (
    <li className="flex gap-3">
      <Avatar name={c.author?.full_name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="rounded-[4px] bg-paper px-4 py-3">
          <p className="text-sm font-medium">
            {c.author?.role === 'veteran' && c.author.username ? <Link href={`/veterans/${c.author.username}`} className="hover:underline">{c.author.full_name}</Link> : c.author?.full_name ?? 'Member'}
            {c.author?.verified && <span className="ml-1 text-brass-dark">✦</span>}
            <span className="ml-2 text-xs font-normal text-muted">{timeAgo(c.created_at)}{c.edited_at && ' · edited'}</span>
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-ink/90">{c.body}</p>
        </div>
        {me && (
          <div className="mt-1 flex flex-wrap gap-3 px-1 text-xs text-muted">
            {!c.parent_id && (
              <details>
                <summary className="cursor-pointer hover:text-navy">Reply</summary>
                <form action={addComment.bind(null, postId)} className="mt-2 flex gap-2">
                  <input type="hidden" name="parent_id" value={c.id} />
                  <input name="body" required maxLength={2000} placeholder="Write a reply…" className="field py-2 text-sm" />
                  <SubmitButton className="btn btn-outline shrink-0 py-2" pendingText="…">Reply</SubmitButton>
                </form>
              </details>
            )}
            {mine && (
              <details>
                <summary className="cursor-pointer hover:text-navy">Edit</summary>
                <form action={updateComment.bind(null, c.id)} className="mt-2 flex gap-2">
                  <input name="body" required defaultValue={c.body} maxLength={2000} className="field py-2 text-sm" />
                  <SubmitButton className="btn btn-outline shrink-0 py-2" pendingText="…">Save</SubmitButton>
                </form>
              </details>
            )}
            {canDelete && (
              <form action={deleteComment.bind(null, c.id)}><button type="submit" className="hover:text-signal">Delete</button></form>
            )}
            {!mine && (
              <details>
                <summary className="cursor-pointer hover:text-signal">Report</summary>
                <form action={reportContent.bind(null, 'comment', c.id)} className="mt-2 flex gap-2">
                  <select name="reason" required defaultValue="" className="field py-2 text-sm">
                    <option value="" disabled>Reason…</option>
                    <option value="spam">Spam</option><option value="harassment">Harassment</option><option value="fraud">Fraud</option>
                    <option value="fake_information">Fake information</option><option value="inappropriate">Inappropriate</option>
                    <option value="impersonation">Impersonation</option><option value="other">Other</option>
                  </select>
                  <SubmitButton className="btn btn-outline shrink-0 py-2" pendingText="…">Send</SubmitButton>
                </form>
              </details>
            )}
          </div>
        )}
        {replies && replies.length > 0 && (
          <ul className="mt-3 space-y-3">
            {replies.map((r) => <CommentItem key={r.id} c={r} me={me} postAuthorId={postAuthorId} postId={postId} />)}
          </ul>
        )}
      </div>
    </li>
  );
}

export default async function PostPage({ params }: { params: { id: string } }) {
  const session = await getSessionProfile();
  const me = session?.user.id ?? null;
  const post = await getPost(params.id, me);
  if (!post) notFound();

  const supabase = createClient();
  const [{ data: commentRows }, { data: reactionRows }, { data: blocks }, { data: mutes }] = await Promise.all([
    supabase.from('post_comments').select('*, author:profiles!post_comments_author_id_fkey(full_name, username, role, verified)').eq('post_id', post.id).order('created_at').limit(300),
    supabase.from('post_reactions').select('reaction, profile:profiles!post_reactions_profile_id_fkey(full_name, username, role)').eq('post_id', post.id).limit(200),
    me ? supabase.from('user_blocks').select('blocked_id').eq('blocker_id', me) : Promise.resolve({ data: [] as { blocked_id: string }[] }),
    me ? supabase.from('user_mutes').select('muted_id').eq('muter_id', me) : Promise.resolve({ data: [] as { muted_id: string }[] }),
  ]);
  const hidden = new Set([...(blocks ?? []).map((b) => b.blocked_id), ...(mutes ?? []).map((m) => m.muted_id)]);
  const comments = ((commentRows ?? []) as Comment[]).filter((c) => !hidden.has(c.author_id));
  const top = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);
  const reactions = (reactionRows ?? []) as unknown as { reaction: string; profile: { full_name: string; username: string | null; role: string } | null }[];

  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <Link href="/network" className="text-sm text-muted hover:text-navy">← Network</Link>
      <PostCard post={post} signedIn={!!session} detail />

      {reactions.length > 0 && (
        <section id="reactions" className="card scroll-mt-24 p-6">
          <h2 className="eyebrow">Reactions ({reactions.length})</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {reactions.map((r, i) => {
              const def = REACTIONS.find(([k]) => k === r.reaction);
              return (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Avatar name={r.profile?.full_name} size="sm" />
                  <span className="flex-1 truncate">{r.profile?.full_name ?? 'Member'}</span>
                  <span className="text-xs text-brass-dark">{def?.[2]} {def?.[1]}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section id="comments" className="card scroll-mt-24 p-6">
        <h2 className="eyebrow">Comments ({post.comment_count})</h2>
        {session && (
          <form action={addComment.bind(null, post.id)} className="mt-4 flex gap-2">
            <label htmlFor="new-comment" className="sr-only">Add a comment</label>
            <input id="new-comment" name="body" required maxLength={2000} placeholder="Add a comment…" className="field" />
            <SubmitButton className="btn btn-primary shrink-0" pendingText="Posting…">Post</SubmitButton>
          </form>
        )}
        {top.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No comments yet. Be the first to congratulate them.</p>
        ) : (
          <ul className="mt-6 space-y-5">
            {top.map((c) => <CommentItem key={c.id} c={c} me={me} postAuthorId={post.author_id} postId={post.id} replies={repliesOf(c.id)} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
