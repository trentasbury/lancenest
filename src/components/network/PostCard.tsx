import Link from 'next/link';
import type { Post } from '@/lib/network';
import { MILESTONE_EYEBROW, REACTIONS, VISIBILITY, mediaUrl, timeAgo } from '@/lib/network';
import SubmitButton from '@/components/SubmitButton';
import Avatar from './Avatar';
import {
  blockUser, deletePost, followUser, muteUser, reactToPost, reportContent, sharePost, toggleSavePost, unfollowUser, updatePost,
} from '@/app/network/actions';

const REPORT_REASONS = [
  ['spam', 'Spam'], ['harassment', 'Harassment'], ['fraud', 'Fraud'], ['fake_information', 'Fake information'],
  ['inappropriate', 'Inappropriate content'], ['impersonation', 'Impersonation'], ['other', 'Other'],
];

function AuthorLine({ post, compact = false }: { post: Post; compact?: boolean }) {
  const a = post.author;
  const name = a?.full_name || 'LanceNest member';
  const href = a?.role === 'veteran' && a.username ? `/veterans/${a.username}` : null;
  const vis = VISIBILITY.find(([v]) => v === post.visibility)?.[1];
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Avatar name={name} size={compact ? 'sm' : 'md'} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-1.5 font-medium text-ink">
          {href ? <Link href={href} className="hover:underline">{name}</Link> : name}
          {a?.verified && <span className="text-brass-dark" title="Verified Veteran">✦</span>}
        </p>
        {!compact && (a?.headline || a?.service_summary) && (
          <p className="truncate text-xs text-muted">{[a?.headline, a?.service_summary].filter(Boolean).join(' · ')}</p>
        )}
        <p className="text-xs text-muted">
          <Link href={`/network/${post.id}`} className="hover:underline">{timeAgo(post.created_at)}</Link>
          {post.edited_at && ' · edited'} · {vis}
          {post.location && ` · ${post.location}`}
        </p>
      </div>
    </div>
  );
}

function Body({ post }: { post: Post }) {
  const isMilestone = !!(post.milestone && post.headline);
  return (
    <>
      {isMilestone && (
        <div className="mt-4 border-l-2 border-brass pl-4">
          <p className="font-serif text-2xl leading-snug text-navy">{post.headline}</p>
          {post.event_date && (
            <p className="mt-1 text-xs text-muted">{new Date(`${post.event_date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
          )}
        </div>
      )}
      {post.body && <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-ink/90">{post.body}</p>}
      {post.media.length > 0 && (
        <div className={`mt-4 grid gap-1.5 overflow-hidden rounded-[4px] ${post.media.length > 1 ? 'grid-cols-2' : ''}`}>
          {post.media.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.storage_path} src={mediaUrl(m.storage_path)} alt="" loading="lazy" className="max-h-[520px] w-full bg-cream object-cover" />
          ))}
        </div>
      )}
    </>
  );
}

export default function PostCard({ post, signedIn, detail = false }: { post: Post; signedIn: boolean; detail?: boolean }) {
  const v = post.viewer;
  const isMilestone = !!(post.milestone && post.headline);
  const eyebrow = MILESTONE_EYEBROW[post.post_type] ?? 'Update';
  const myReaction = REACTIONS.find(([r]) => r === v?.reaction);
  const canShare = !post.is_share && (post.visibility === 'public' || post.visibility === 'network');

  return (
    <article className={`card overflow-hidden ${isMilestone ? 'border-brass/50' : ''}`}>
      {isMilestone && (
        <div className="flex items-center gap-2 bg-navy-deep px-6 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">
          <span aria-hidden="true">✦</span> {eyebrow}
        </div>
      )}
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <AuthorLine post={post} />
          {signedIn && v && (
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-[3px] px-2 py-1 text-lg leading-none text-muted hover:bg-cream" aria-label="More options">⋯</summary>
              <div className="absolute right-0 z-20 mt-1 w-72 space-y-1 rounded-[4px] border border-line bg-ivory p-2 text-sm shadow-card">
                {v.isAuthor ? (
                  <>
                    <details>
                      <summary className="cursor-pointer rounded-[3px] px-3 py-2 hover:bg-cream">Edit post</summary>
                      <form action={updatePost.bind(null, post.id)} className="space-y-2 p-2">
                        <textarea name="body" defaultValue={post.body} rows={4} maxLength={3000} className="field text-sm" />
                        <select name="visibility" defaultValue={post.visibility} className="field text-sm">
                          {VISIBILITY.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                        </select>
                        <SubmitButton className="btn btn-primary w-full py-2" pendingText="Saving…">Save changes</SubmitButton>
                      </form>
                    </details>
                    <form action={deletePost.bind(null, post.id)}>
                      <input type="hidden" name="redirect" value={detail ? 'feed' : ''} />
                      <button type="submit" className="w-full rounded-[3px] px-3 py-2 text-left text-signal hover:bg-signal/5">Delete post</button>
                    </form>
                  </>
                ) : (
                  <>
                    <form action={(v.followsAuthor ? unfollowUser : followUser).bind(null, post.author_id)}>
                      <button type="submit" className="w-full rounded-[3px] px-3 py-2 text-left hover:bg-cream">
                        {v.followsAuthor ? 'Unfollow' : 'Follow'} {post.author?.full_name?.split(' ')[0] ?? 'member'}
                      </button>
                    </form>
                    <form action={muteUser.bind(null, post.author_id)}>
                      <button type="submit" className="w-full rounded-[3px] px-3 py-2 text-left hover:bg-cream">Mute (hide their posts)</button>
                    </form>
                    <form action={blockUser.bind(null, post.author_id)}>
                      <button type="submit" className="w-full rounded-[3px] px-3 py-2 text-left hover:bg-cream">Block</button>
                    </form>
                    <details>
                      <summary className="cursor-pointer rounded-[3px] px-3 py-2 text-signal hover:bg-signal/5">Report post</summary>
                      <form action={reportContent.bind(null, 'post', post.id)} className="space-y-2 p-2">
                        <select name="reason" required defaultValue="" className="field text-sm">
                          <option value="" disabled>Choose a reason…</option>
                          {REPORT_REASONS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                        </select>
                        <textarea name="details" rows={2} maxLength={1000} placeholder="Anything else? (optional)" className="field text-sm" />
                        <SubmitButton className="btn btn-outline w-full py-2" pendingText="Sending…">Send report</SubmitButton>
                      </form>
                    </details>
                  </>
                )}
              </div>
            </details>
          )}
        </div>

        <Body post={post} />

        {post.is_share && (
          <div className="mt-4 rounded-[4px] border border-line bg-paper p-4">
            {post.shared ? (
              <>
                <AuthorLine post={post.shared} compact />
                <Body post={post.shared} />
                <Link href={`/network/${post.shared.id}`} className="mt-3 inline-block text-xs text-navy underline decoration-brass underline-offset-4">View original post</Link>
              </>
            ) : (
              <p className="text-sm text-muted">This post is no longer available.</p>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          {post.reaction_count > 0 && <Link href={`/network/${post.id}#reactions`} className="hover:underline">{post.reaction_count} reaction{post.reaction_count > 1 ? 's' : ''}</Link>}
          {post.comment_count > 0 && <Link href={`/network/${post.id}#comments`} className="hover:underline">{post.comment_count} comment{post.comment_count > 1 ? 's' : ''}</Link>}
          {post.share_count > 0 && <span>{post.share_count} share{post.share_count > 1 ? 's' : ''}</span>}
        </div>

        {signedIn && (
          <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-3 text-sm">
            <details className="relative">
              <summary className={`cursor-pointer list-none rounded-[3px] px-3 py-2 hover:bg-cream ${myReaction ? 'font-semibold text-brass-dark' : 'text-ink'}`}>
                {myReaction ? `${myReaction[2]} ${myReaction[1]}` : '✦ React'}
              </summary>
              <div className="absolute bottom-full left-0 z-20 mb-1 flex flex-wrap gap-1 rounded-[4px] border border-line bg-ivory p-2 shadow-card sm:w-max">
                {REACTIONS.map(([key, label, glyph]) => (
                  <form key={key} action={reactToPost.bind(null, post.id, key)}>
                    <button type="submit" className={`rounded-full border px-3 py-1.5 text-xs ${v?.reaction === key ? 'border-brass bg-brass/15 text-brass-dark' : 'border-line hover:border-brass'}`}>
                      <span aria-hidden="true">{glyph}</span> {label}
                    </button>
                  </form>
                ))}
              </div>
            </details>
            <Link href={`/network/${post.id}#comments`} className="rounded-[3px] px-3 py-2 text-ink hover:bg-cream">Comment</Link>
            {canShare && (
              <details className="relative">
                <summary className="cursor-pointer list-none rounded-[3px] px-3 py-2 text-ink hover:bg-cream">Share</summary>
                <form action={sharePost.bind(null, post.id)} className="absolute bottom-full left-0 z-20 mb-1 w-72 space-y-2 rounded-[4px] border border-line bg-ivory p-3 shadow-card">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Share to your network</p>
                  <textarea name="body" rows={2} maxLength={3000} placeholder="Add a note (optional)" className="field text-sm" />
                  <select name="visibility" defaultValue="network" className="field text-sm">
                    {VISIBILITY.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                  </select>
                  <SubmitButton className="btn btn-primary w-full py-2" pendingText="Sharing…">Share</SubmitButton>
                </form>
              </details>
            )}
            <form action={toggleSavePost.bind(null, post.id)} className="ml-auto">
              <button type="submit" className={`rounded-[3px] px-3 py-2 hover:bg-cream ${v?.saved ? 'font-semibold text-brass-dark' : 'text-ink'}`}>
                {v?.saved ? '★ Saved' : '☆ Save'}
              </button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}
