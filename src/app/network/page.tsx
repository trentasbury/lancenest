import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { FEED_FILTERS, MILESTONES_BY_TYPE, POST_TYPES, VISIBILITY, getFeed, getSuggestions } from '@/lib/network';
import Composer from '@/components/network/Composer';
import PostCard from '@/components/network/PostCard';
import SuggestionList from '@/components/network/SuggestionList';
import ProfileMini from '@/components/network/ProfileMini';

export const metadata: Metadata = { title: 'Network' };

export default async function NetworkPage({ searchParams }: { searchParams: { type?: string; scope?: string; view?: string; cursor?: string } }) {
  const { user, profile } = await requireRole(['veteran', 'employer', 'admin'], '/network');
  const supabase = createClient();
  // Suggestions don't depend on anything below — start them now so they load alongside the feed.
  const suggestionsPromise = getSuggestions(user.id);
  const [{ count: followingCount }, { count: followerCount }] = await Promise.all([
    supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
    supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
  ]);

  const saved = searchParams.view === 'saved';
  // Prioritize people you follow; fall back to the whole network until you follow someone.
  const scope = searchParams.scope === 'everyone' || !followingCount ? 'everyone' : searchParams.scope === 'following' ? 'following' : 'following';
  const type = FEED_FILTERS.some(([v]) => v === searchParams.type) ? searchParams.type : undefined;
  const [{ posts, nextCursor }, suggestions] = await Promise.all([
    getFeed({ viewerId: user.id, scope: saved ? 'everyone' : scope, type, cursor: searchParams.cursor, savedOnly: saved }),
    suggestionsPromise,
  ]);

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { type, scope: searchParams.scope, view: searchParams.view, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return s ? `/network?${s}` : '/network';
  };

  return (
    <>
      <h1 className="sr-only">{saved ? 'Saved posts' : 'LanceNest Network'}</h1>
      <div className="container-page grid items-start gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[230px_minmax(0,1fr)_300px]">
        <aside className="hidden xl:sticky xl:top-[92px] xl:block">
          <ProfileMini profile={profile} followers={followerCount ?? 0} following={followingCount ?? 0} saved={saved} />
        </aside>
        <div className="min-w-0 space-y-4">
          {saved && <h2 className="font-sans text-xl font-semibold text-ink">Saved posts</h2>}
          {!saved && (
            <Composer
              userId={user.id}
              name={profile.full_name}
              avatarUrl={profile.avatar_url}
              postTypes={POST_TYPES}
              milestonesByType={MILESTONES_BY_TYPE}
              visibility={VISIBILITY}
            />
          )}

          {!saved && (
            <div className="space-y-3">
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                {FEED_FILTERS.map(([v, label]) => (
                  <Link key={label} href={qs({ type: v || undefined, cursor: undefined })}
                    className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm ${(type ?? '') === v ? 'border-navy bg-navy text-ivory' : 'border-line bg-ivory text-ink hover:border-brass'}`}>
                    {label}
                  </Link>
                ))}
              </div>
              {!!followingCount && (
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted">Latest from</span>
                  <Link href={qs({ scope: 'following' })} className={scope === 'following' ? 'font-semibold text-navy' : 'text-muted hover:text-navy'}>People you follow</Link>
                  <Link href={qs({ scope: 'everyone' })} className={scope === 'everyone' ? 'font-semibold text-navy' : 'text-muted hover:text-navy'}>Everyone</Link>
                </div>
              )}
            </div>
          )}

          {posts.length === 0 && !searchParams.cursor ? (
            <div className="card p-8 text-center">
              <p className="font-sans text-2xl font-semibold">{saved ? 'No saved posts yet.' : 'Your network starts here.'}</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                {saved ? 'Tap ☆ Save on any post to keep it here.' : 'Share your first milestone, or follow people who served where you did.'}
              </p>
              {!saved && (
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link href="/network#grow" className="btn btn-primary">Find Veterans</Link>
                  <Link href="/network?scope=everyone" className="btn btn-outline">Discover Professionals</Link>
                  <Link href="/network#grow" className="btn btn-outline">Grow Your Network</Link>
                </div>
              )}
              {!saved && suggestions.length > 0 && (
                <div className="mx-auto mt-8 max-w-md text-left"><SuggestionList people={suggestions} /></div>
              )}
            </div>
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} signedIn />)
          )}

          {nextCursor && (
            <div className="text-center">
              <Link href={qs({ cursor: nextCursor })} className="btn btn-outline">Load older posts</Link>
            </div>
          )}
          {searchParams.cursor && !nextCursor && posts.length > 0 && <p className="text-center text-sm text-muted">You’re all caught up.</p>}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-[92px]">
          <div className="xl:hidden">
            <ProfileMini profile={profile} followers={followerCount ?? 0} following={followingCount ?? 0} saved={saved} />
          </div>
          <div id="grow" className="card scroll-mt-24 p-6">
            <h2 className="font-sans text-base font-semibold text-ink">Grow your network</h2>
            <div className="mt-4"><SuggestionList people={suggestions} /></div>
          </div>
        </aside>
      </div>
    </>
  );
}
