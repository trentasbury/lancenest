import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import VerificationBadge from '@/components/VerificationBadge';
import VerifiedNote from '@/components/VerifiedNote';
import { CLEARANCES, COMPONENTS, yearOf } from '@/lib/military';
import { initials } from '@/lib/format';
import { FEED_FILTERS, MILESTONES_BY_TYPE, PAGE_SIZE, POST_TYPES, VISIBILITY, getFeed, mediaUrl, type Post } from '@/lib/network';
import PostCard from '@/components/network/PostCard';
import Composer from '@/components/network/Composer';
import SubmitButton from '@/components/SubmitButton';
import { followUser, reportContent, unfollowUser } from '@/app/network/actions';
import { startConversation } from '@/app/messages/actions';
import Upsell from '@/components/employer/Upsell';
import PlanBadge from '@/components/PlanBadge';
import VerifiedMark from '@/components/VerifiedMark';
import { DELIVERY_LABEL, PRICE_LABEL } from '@/lib/freelance';
import { saveToPool } from '@/app/employer/talent/actions';
import { decideRecommendation, writeRecommendation } from '@/app/network/recommendActions';

type Profile = { id: string; full_name: string; username: string; headline: string | null; location: string | null; avatar_url: string | null };
type Vet = { plan?: string; about: string | null; clearance_level: string; verification_status: string; willing_to_relocate: boolean };
type Service = {
  id: string; branch: string; component: string; rank: string | null; occupation_code: string | null;
  start_date: string | null; end_date: string | null; deployments: number; duty_title: string | null; unit: string | null; description: string | null;
  occupation: { title: string; civilian_categories: string[]; civilian_skills: string[] } | null;
};

// Shared by the page title and the page itself: one lookup per request.
const load = cache(async (username: string) => {
  const supabase = createClient();
  // Row-level security decides visibility: the owner, employers, admins, or anyone if the profile is public.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, username, headline, location, avatar_url')
    .eq('username', username)
    .in('role', ['veteran', 'admin'])
    .maybeSingle();
  if (!profile) return null;

  const { data: vet } = await supabase
    .from('veteran_profiles')
    .select('about, clearance_level, verification_status, willing_to_relocate, plan')
    .eq('profile_id', profile.id)
    .maybeSingle();

  return { supabase, profile: profile as Profile, vet: (vet as Vet) ?? null };
});

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const data = await load(params.username);
  if (!data || !data.vet) return { title: 'Profile', robots: { index: false } };
  return {
    title: data.profile.full_name,
    description: data.profile.headline ?? `${data.profile.full_name} on LanceNest`,
  };
}

type Tab = 'profile' | 'posts' | 'photos';
const TABS: [Tab, string][] = [['profile', 'Profile'], ['posts', 'Posts'], ['photos', 'Photos']];

export default async function VeteranProfilePage({ params, searchParams }: { params: { username: string }; searchParams: { rec?: string; tab?: string; type?: string; cursor?: string } }) {
  const data = await load(params.username);
  if (!data) notFound();
  const { supabase, profile } = data;
  const viewer = await getSessionProfile();
  // Access checks first (both at once): employers this member hid from, and unverified members.
  const [{ data: hiding }, { data: me }] = await Promise.all([
    viewer?.profile?.role === 'employer' ? supabase.rpc('members_hiding_me') : Promise.resolve({ data: [] }),
    viewer?.profile?.role === 'veteran' && viewer.user.id !== profile.id
      ? supabase.from('veteran_profiles').select('verification_status').eq('profile_id', viewer.user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (viewer?.profile?.role === 'employer' && ((hiding ?? []) as string[]).includes(profile.id)) notFound();
  if (viewer?.profile?.role === 'veteran' && viewer.user.id !== profile.id) {
    if ((me as { verification_status?: string } | null)?.verification_status !== 'verified') redirect('/dashboard/verification?required=1');
  }

  // Hidden by the database: a Free employer who hasn't received an application from this veteran.
  if (!data.vet) {
    if (viewer?.profile?.role !== 'employer') notFound();
    return (
      <div className="container-page max-w-3xl py-12">
        <div className="card mb-6 flex items-center gap-4 p-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-brass bg-navy font-serif text-xl text-brass">{initials(profile.full_name)}</div>
          <div><p className="font-serif text-3xl">{profile.full_name}</p>{profile.headline && <p className="text-muted">{profile.headline}</p>}</div>
        </div>
        <Upsell title="Unlock full veteran profiles." body="See service history, skills, clearance, and experience for every veteran on LanceNest — and message them first. Free plans see full profiles only for candidates who apply." />
      </div>
    );
  }
  const vet = data.vet;
  const session = viewer;
  const viewerId = session?.user.id ?? null;
  const none = Promise.resolve({ data: null });
  // Profile (résumé + recent activity), Posts (the full wall), or Photos.
  const tab: Tab = searchParams.tab === 'posts' || searchParams.tab === 'photos' ? searchParams.tab : 'profile';
  const wallType = tab === 'posts' && FEED_FILTERS.some(([v]) => v && v === searchParams.type) ? searchParams.type : undefined;

  // Every section of the profile is independent: load them all in one round instead of eight.
  const [
    ,
    { data: service }, { data: skillRows }, { data: experience }, { data: education },
    { posts, nextCursor }, { count: followers }, { data: iFollow },
    { data: verifiedWork },
    { data: recs }, { data: myPendingRecs }, { data: mentorRow }, { data: wroteOne },
    { data: offered }, { data: reviews },
    { data: freelance }, { data: portfolio },
    photoFeed, { count: postCount },
  ] = await Promise.all([
    // Count one profile view per visit, not one per tab clicked.
    viewer && viewer.user.id !== profile.id && tab === 'profile'
      ? supabase.from('profile_views').insert({ profile_id: profile.id, viewer_id: viewer.user.id }).then(() => undefined, () => undefined)
      : Promise.resolve(undefined),
    supabase.from('military_service').select('*, occupation:military_occupations(title, civilian_categories, civilian_skills)').eq('profile_id', profile.id).order('start_date', { ascending: false }),
    supabase.from('profile_skills').select('skill:skills(name)').eq('profile_id', profile.id),
    supabase.from('experience').select('*').eq('profile_id', profile.id).order('start_date', { ascending: false }),
    supabase.from('education').select('*').eq('profile_id', profile.id).order('graduation_year', { ascending: false }),
    tab === 'posts'
      ? getFeed({ viewerId, authorId: profile.id, limit: PAGE_SIZE, type: wallType, cursor: searchParams.cursor })
      : tab === 'profile' ? getFeed({ viewerId, authorId: profile.id, limit: 2 }) : Promise.resolve({ posts: [] as Post[], nextCursor: null }),
    supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
    viewerId ? supabase.from('user_follows').select('following_id').eq('follower_id', viewerId).eq('following_id', profile.id) : Promise.resolve({ data: [] }),
    viewer ? supabase.rpc('verified_work', { p: profile.id }) : Promise.resolve({ data: [] }),
    supabase.from('recommendations').select('id, relationship, body, created_at, author:profiles!recommendations_author_id_fkey(full_name, username, headline, verified)').eq('subject_id', profile.id).eq('status', 'accepted').order('created_at', { ascending: false }),
    viewer?.user?.id === profile.id ? supabase.from('recommendations').select('id, relationship, body, author:profiles!recommendations_author_id_fkey(full_name)').eq('subject_id', profile.id).eq('status', 'pending') : Promise.resolve({ data: [] }),
    supabase.from('mentor_profiles').select('available').eq('profile_id', profile.id).maybeSingle(),
    viewer?.user?.id && viewer.user.id !== profile.id ? supabase.from('recommendations').select('id').eq('author_id', viewer.user.id).eq('subject_id', profile.id).maybeSingle() : none,
    supabase.from('service_listings').select('id, title, category, price_cents, price_type, delivery, service_area').eq('profile_id', profile.id).eq('status', 'active').order('created_at', { ascending: false }),
    supabase.from('reviews').select('rating, body, created_at').eq('reviewee_id', profile.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('freelancer_profiles').select('title, bio, hourly_rate, available, clearance_work, vosb, sdvosb').eq('profile_id', profile.id).maybeSingle(),
    supabase.from('portfolio_items').select('id, title, description, url').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(6),
    tab === 'profile' ? Promise.resolve({ posts: [] as Post[], nextCursor: null }) : getFeed({ viewerId, authorId: profile.id, type: 'photos', limit: tab === 'photos' ? 48 : 9 }),
    // Row-level security counts only the posts this viewer is allowed to see.
    supabase.from('network_posts').select('id', { count: 'exact', head: true }).eq('author_id', profile.id).is('group_id', null),
  ]);
  const following = (iFollow ?? []).length > 0;
  type RecRow = { id: string; relationship: string; body: string; author: { full_name: string; username?: string | null; headline?: string | null; verified?: boolean } | null };
  const avg = (reviews ?? []).length ? (reviews ?? []).reduce((a, r) => a + (r.rating as number), 0) / (reviews ?? []).length : 0;
  const services = (service ?? []) as unknown as Service[];
  const skills = ((skillRows ?? []) as unknown as { skill: { name: string } | null }[]).map((r) => r.skill?.name).filter(Boolean) as string[];
  const isOwner = session?.user.id === profile.id;
  const primary = services[0];
  const translated = Array.from(new Set(services.flatMap((s) => s.occupation?.civilian_categories ?? []))).slice(0, 8);
  const clearance = CLEARANCES.find(([v]) => v === vet.clearance_level)?.[1];
  const first = profile.full_name.split(' ')[0];
  // Posting needs a verified account (the database enforces this too); admins can always post.
  const canPost = isOwner && (viewer?.profile?.role === 'admin' || vet.verification_status === 'verified');
  const tabHref = (t: Tab, extra: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams();
    if (t !== 'profile') p.set('tab', t);
    Object.entries(extra).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return `/veterans/${profile.username}${s ? `?${s}` : ''}`;
  };
  const photos = photoFeed.posts.flatMap((p) => [...p.media].sort((a, b) => a.position - b.position).map((m) => ({ postId: p.id, src: mediaUrl(m.storage_path) })));
  const composer = canPost ? (
    <Composer userId={profile.id} name={profile.full_name} avatarUrl={profile.avatar_url} postTypes={POST_TYPES} milestonesByType={MILESTONES_BY_TYPE} visibility={VISIBILITY}
      prompt={`What have you been working on, ${first}?`} heading="Post to your profile" />
  ) : isOwner ? (
    <div className="card flex flex-col gap-3 p-5 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted">Once your service is verified, you can post updates, milestones and photos here.</p>
      <Link href="/dashboard/verification" className="btn btn-outline shrink-0">Get verified</Link>
    </div>
  ) : null;
  const emptyWall = (
    <div className="card p-8 text-center">
      <p className="font-sans text-lg font-semibold text-ink">{isOwner ? 'Your wall is empty.' : `${first} hasn’t posted yet.`}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        {isOwner ? 'Share what you’re working on: a new certification, a project, a job change, or a move.' : 'Follow them to see their updates in your feed.'}
      </p>
    </div>
  );

  return (
    <>
      <div className="container-page pt-6">
        <section className="card overflow-hidden">
          {/* LinkedIn-style header: cover band, overlapping photo, then name, headline and actions. */}
          <div className="relative h-28 bg-gradient-to-r from-navy-deep via-navy to-navy-soft sm:h-40" aria-hidden="true">
            <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,#d9c9a8_1px,transparent_0)] [background-size:18px_18px]" />
          </div>
          <div className="px-5 pb-6 sm:px-8">
            {/* relative + z-10: the cover is positioned, so without this it paints over the top half of the photo. */}
            <div className="relative z-10 -mt-14 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={profile.full_name} className="h-28 w-28 shrink-0 rounded-full border-4 border-ivory object-cover shadow-md sm:h-36 sm:w-36" />
              ) : (
                <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-4 border-ivory bg-navy font-serif text-4xl text-brass shadow-md sm:h-36 sm:w-36">
                  {initials(profile.full_name)}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 sm:pb-1">
                {isOwner ? (
                  <Link href="/dashboard/profile" className="btn btn-primary">Edit profile</Link>
                ) : session ? (
                  <>
                    <form action={(following ? unfollowUser : followUser).bind(null, profile.id)}>
                      <SubmitButton className={following ? 'btn btn-outline' : 'btn btn-primary'} pendingText="…">{following ? 'Following ✓' : '+ Follow'}</SubmitButton>
                    </form>
                    <form action={startConversation.bind(null, profile.id)}>
                      <SubmitButton className="btn btn-outline" pendingText="…">Message</SubmitButton>
                    </form>
                  </>
                ) : (
                  <Link href={`/login?next=/veterans/${profile.username}`} className="btn btn-primary">Log in to connect</Link>
                )}
              </div>
            </div>

            <div className="mt-4">
              <h1 className="font-sans text-2xl font-bold tracking-tight text-ink sm:text-3xl">{profile.full_name}<PlanBadge plan={vet.plan} />{mentorRow?.available && <span className="ml-1.5 inline-block rounded-full border border-olive bg-olive/10 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-[0.1em] text-olive">Mentor</span>}</h1>
              {profile.headline && <p className="mt-1 text-base text-ink/85 sm:text-lg">{profile.headline}</p>}
              <p className="mt-1.5 text-sm text-muted">
                {[primary ? `${primary.branch}${primary.rank ? ` · ${primary.rank}` : ''}` : null, profile.location, vet.willing_to_relocate ? 'Open to relocation' : null]
                  .filter(Boolean)
                  .join(' · ')}
                <span className="mx-1.5">·</span>
                <span className="font-medium text-navy">{followers ?? 0} follower{followers === 1 ? '' : 's'}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <VerificationBadge status={vet.verification_status} />
                {clearance && vet.clearance_level !== 'none' && (isOwner || viewer?.profile?.role === 'employer' || viewer?.profile?.role === 'admin') && (
                  <span className="inline-flex items-center rounded-full border border-brass/60 bg-brass/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brass-dark">
                    {clearance} clearance
                  </span>
                )}
              </div>
              {vet.verification_status === 'verified' && (viewer?.profile?.role === 'employer' || viewer?.profile?.role === 'admin') && (
                <p className="mt-2 max-w-2xl text-xs text-muted"><VerifiedNote /></p>
              )}
              {isOwner && <p className="mt-3 text-xs text-muted">This is how employers and members see your profile.</p>}
            </div>

            {(viewer?.profile?.role === 'employer' || (session && !isOwner)) && (
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-line/80 pt-3">
                {viewer?.profile?.role === 'employer' && (
                  <details className="text-sm text-muted">
                    <summary className="cursor-pointer font-medium text-navy hover:underline">Save to talent pool</summary>
                    <form action={saveToPool.bind(null, profile.id, `/veterans/${params.username}`)} className="mt-2 flex w-72 max-w-full flex-col gap-2 text-ink">
                      <input name="list" placeholder="List name (e.g. Q1 cyber hires)" className="field py-2 text-sm" />
                      <textarea name="note" rows={2} maxLength={1000} placeholder="Private note (optional)" className="field py-2 text-sm" />
                      <SubmitButton className="btn btn-outline py-1.5 text-xs" pendingText="Saving…">Save</SubmitButton>
                    </form>
                  </details>
                )}
                {session && !isOwner && (
                  <details className="text-sm text-muted">
                    <summary className="cursor-pointer hover:text-ink">Report this member</summary>
                    <form action={reportContent.bind(null, 'profile', profile.id)} className="mt-2 flex w-72 max-w-full flex-col gap-2 text-ink">
                      <select name="reason" required defaultValue="" className="field py-2 text-sm">
                        <option value="" disabled>Reason…</option>
                        <option value="harassment">Harassment or unprofessional conduct</option><option value="impersonation">Impersonation or false service claims</option>
                        <option value="fraud">Scam or fraud</option><option value="spam">Spam</option><option value="inappropriate">Inappropriate content</option><option value="sensitive_info">Shares SSN, personal info, or OPSEC-sensitive details</option><option value="other">Other</option>
                      </select>
                      <textarea name="details" rows={2} maxLength={1000} placeholder="What happened? (optional)" className="field py-2 text-sm" />
                      <SubmitButton className="btn btn-outline py-1.5 text-xs" pendingText="Sending…">Send report</SubmitButton>
                    </form>
                  </details>
                )}
              </div>
            )}

            <nav aria-label="Profile sections" className="-mx-5 -mb-6 mt-5 flex overflow-x-auto border-t border-line/80 px-2 sm:-mx-8 sm:px-5">
              {TABS.map(([key, label]) => {
                const on = tab === key;
                return (
                  <Link key={key} href={tabHref(key)} scroll={false} aria-current={on ? 'page' : undefined}
                    className={`relative flex items-center whitespace-nowrap px-4 py-3.5 text-sm font-semibold transition-colors ${on ? 'text-navy' : 'text-muted hover:text-navy'}`}>
                    {label}
                    {key === 'posts' && !!postCount && <span className="ml-1.5 rounded-full bg-paper px-2 py-0.5 text-xs font-medium text-muted">{postCount}</span>}
                    <span aria-hidden="true" className={`absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-navy transition-opacity ${on ? 'opacity-100' : 'opacity-0'}`} />
                  </Link>
                );
              })}
            </nav>
          </div>
        </section>
      </div>

      {tab === 'posts' && (
        <div className="container-page grid items-start gap-6 py-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4 lg:order-2">
            {!wallType && !searchParams.cursor && composer}
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
              {FEED_FILTERS.map(([v, label]) => (
                <Link key={label} href={tabHref('posts', { type: v || undefined })} scroll={false}
                  className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm ${(wallType ?? '') === v ? 'border-navy bg-navy text-ivory' : 'border-line bg-ivory text-ink hover:border-brass'}`}>
                  {label}
                </Link>
              ))}
            </div>
            {posts.length === 0 && !searchParams.cursor
              ? (wallType ? <div className="card p-6 text-sm text-muted">Nothing in this category yet.</div> : emptyWall)
              : posts.map((post) => <PostCard key={post.id} post={post} signedIn={!!session} />)}
            {nextCursor && (
              <div className="text-center"><Link href={tabHref('posts', { type: wallType, cursor: nextCursor })} scroll={false} className="btn btn-outline">Load older posts</Link></div>
            )}
            {searchParams.cursor && !nextCursor && posts.length > 0 && <p className="text-center text-sm text-muted">That’s everything {isOwner ? 'you’ve' : `${first} has`} posted.</p>}
          </div>

          <aside className="space-y-4 lg:order-1">
            <div className="card p-6">
              <h2 className="font-sans text-lg font-semibold text-ink">Intro</h2>
              {vet.about && <p className="mt-3 line-clamp-5 whitespace-pre-line text-sm leading-relaxed text-ink/85">{vet.about}</p>}
              <ul className="mt-4 space-y-3 text-sm text-ink/85">
                {primary && <IntroRow icon="service">{primary.branch}{primary.rank ? ` · ${primary.rank}` : ''}</IntroRow>}
                {primary?.occupation?.title && <IntroRow icon="role">{primary.occupation.title}</IntroRow>}
                {profile.location && <IntroRow icon="place">Lives in {profile.location}</IntroRow>}
                {vet.willing_to_relocate && <IntroRow icon="move">Open to relocation</IntroRow>}
                <IntroRow icon="people">{followers ?? 0} follower{followers === 1 ? '' : 's'}</IntroRow>
              </ul>
              <Link href={tabHref('profile')} scroll={false} className="btn btn-outline mt-5 w-full">See full profile</Link>
            </div>
            <div className="card p-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-sans text-lg font-semibold text-ink">Photos</h2>
                {photos.length > 0 && <Link href={tabHref('photos')} scroll={false} className="text-sm font-medium text-navy hover:underline">See all</Link>}
              </div>
              {photos.length === 0 ? (
                <p className="mt-3 text-sm text-muted">{isOwner ? 'Photos you add to posts show up here.' : 'No photos yet.'}</p>
              ) : (
                <div className="mt-4 grid grid-cols-3 gap-1.5 overflow-hidden rounded-xl">
                  {photos.slice(0, 9).map((ph) => (
                    <Link key={ph.src} href={`/network/${ph.postId}`} className="block aspect-square bg-paper">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ph.src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-opacity hover:opacity-90" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {tab === 'photos' && (
        <div className="container-page py-6">
          <section className="card p-6 sm:p-7">
            <h2 className="font-sans text-lg font-semibold text-ink">Photos</h2>
            {photos.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{isOwner ? 'Add photos to a post and they’ll appear here.' : `${first} hasn’t shared any photos yet.`}</p>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((ph) => (
                  <Link key={ph.src} href={`/network/${ph.postId}`} className="block aspect-square overflow-hidden rounded-xl bg-paper">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ph.src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]" />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'profile' && (
      <div className="container-page grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {vet.about && (
            <section className="card p-7">
              <h2 className="font-sans text-lg font-semibold text-ink">About</h2>
              <p className="mt-3 whitespace-pre-line text-[16px] leading-relaxed text-ink/90">{vet.about}</p>
            </section>
          )}

          <section id="activity" className="scroll-mt-24 space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="font-sans text-lg font-semibold text-ink">Activity</h2>
                <p className="text-sm text-muted">{postCount ?? 0} post{postCount === 1 ? '' : 's'}</p>
              </div>
              {!!postCount && <Link href={tabHref('posts')} scroll={false} className="text-sm font-semibold text-navy hover:underline">Show all posts →</Link>}
            </div>
            {composer}
            {posts.length === 0 ? emptyWall : posts.map((post) => <PostCard key={post.id} post={post} signedIn={!!session} />)}
          </section>

          <section className="card p-7">
            <h2 className="font-sans text-lg font-semibold text-ink">Military career</h2>
            {services.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No service history added yet.</p>
            ) : (
              <ul className="mt-4 space-y-5">
                {services.map((s) => (
                  <li key={s.id} className="border-l-2 border-brass pl-4">
                    {s.duty_title && <p className="font-serif text-xl font-semibold">{s.duty_title}</p>}
                    <p className={s.duty_title ? 'text-sm font-medium text-ink/80' : 'font-serif text-xl font-semibold'}>
                      {s.occupation?.title ?? s.occupation_code ?? s.branch}
                      {s.occupation_code && s.occupation && <span className="font-sans text-sm font-normal text-muted"> · {s.occupation_code}</span>}
                    </p>
                    <p className="text-sm text-muted">
                      {s.branch}{s.rank ? ` · ${s.rank}` : ''} · {COMPONENTS.find(([v]) => v === s.component)?.[1]} · {yearOf(s.start_date) || '—'}–{yearOf(s.end_date) || 'Present'}
                      {s.deployments > 0 && ` · ${s.deployments} deployment${s.deployments > 1 ? 's' : ''}`}
                    </p>
                    {s.unit && <p className="text-sm text-muted">{s.unit}</p>}
                    {s.description && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink/85">{s.description}</p>}
                    {s.occupation && s.occupation.civilian_skills.length > 0 && (
                      <p className="mt-2 text-sm text-navy">{s.occupation.civilian_skills.join(' · ')}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {freelance && (
            <section className="card border-brass/40 p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-sans text-lg font-semibold text-ink">Available for freelance</h2>
                  <p className="mt-2 font-serif text-2xl text-navy">{freelance.title as string}</p>
                </div>
                {freelance.hourly_rate && <p className="font-serif text-2xl">${freelance.hourly_rate as number}/hr</p>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {freelance.sdvosb && <span className="rounded-full border border-brass px-3 py-1 font-semibold text-brass-dark">SDVOSB</span>}
                {freelance.vosb && !freelance.sdvosb && <span className="rounded-full border border-brass px-3 py-1 font-semibold text-brass-dark">VOSB</span>}
                {freelance.clearance_work && <span className="rounded-full border border-line px-3 py-1">Open to cleared work</span>}
                {!freelance.available && <span className="rounded-full border border-line px-3 py-1 text-muted">Not taking new work</span>}
              </div>
              {(reviews ?? []).length > 0 && (
                <p className="mt-3 text-sm"><span className="text-brass">{'★'.repeat(Math.round(avg))}{'☆'.repeat(5 - Math.round(avg))}</span> <span className="font-medium">{avg.toFixed(1)}</span> <span className="text-muted">· {(reviews ?? []).length} client review{(reviews ?? []).length === 1 ? '' : 's'}</span></p>
              )}
              {freelance.bio && <p className="mt-3 whitespace-pre-line text-sm text-ink/90">{freelance.bio as string}</p>}
              {(reviews ?? []).filter((r) => r.body).slice(0, 3).map((r, i) => <blockquote key={i} className="mt-3 border-l-2 border-brass pl-3 text-sm italic text-ink/80">“{r.body as string}”</blockquote>)}
              {(portfolio ?? []).length > 0 && (
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {(portfolio ?? []).map((it) => (
                    <li key={it.id as string} className="rounded-xl border border-line p-4">
                      <p className="font-medium">{it.title as string}</p>
                      {it.description && <p className="mt-1 text-sm text-muted">{it.description as string}</p>}
                      {it.url && <a href={it.url as string} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-navy underline">View work ↗</a>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {((verifiedWork ?? []) as unknown[]).length > 0 && (
            <section className="card p-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-sans text-lg font-semibold text-ink">Verified work</h2>
                <span className="rounded-full border border-olive/40 bg-olive/10 px-3 py-1 text-[11px] font-semibold text-olive">✓ Completed and paid through LanceNest</span>
              </div>
              <ul className="mt-4 divide-y divide-line">
                {((verifiedWork ?? []) as { title: string; completed_at: string; client_name: string | null; rating: number | null; review: string | null }[]).map((w, i) => (
                  <li key={i} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">{w.title}</p>
                      {w.rating ? <span className="text-sm text-brass">{'★'.repeat(w.rating)}{'☆'.repeat(5 - w.rating)}</span> : null}
                    </div>
                    <p className="text-xs text-muted">{w.client_name ? `for ${w.client_name} · ` : ''}{new Date(w.completed_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
                    {w.review && <p className="mt-1 text-sm italic text-ink/80">“{w.review}”</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(offered ?? []).length > 0 && (
            <section className="card p-7">
              <h2 className="font-sans text-lg font-semibold text-ink">Services</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {(offered ?? []).map((sv) => (
                  <li key={sv.id as string}><Link href={`/freelance/services/${sv.id}`} className="block rounded-xl border border-line p-4 hover:border-brass">
                    <p className="font-medium text-navy">{sv.title as string}</p>
                    <p className="text-xs text-muted">{sv.category as string} · {DELIVERY_LABEL[sv.delivery as string]}{sv.service_area ? ` · ${sv.service_area}` : ''}</p>
                    <p className="mt-1 text-sm font-semibold">${((sv.price_cents as number) / 100).toLocaleString()}{PRICE_LABEL[sv.price_type as string]} <span className="font-normal text-olive">· Hire →</span></p>
                  </Link></li>
                ))}
              </ul>
            </section>
          )}

          {(((recs ?? []) as unknown as RecRow[]).length > 0 || ((myPendingRecs ?? []) as unknown[]).length > 0 || (viewer?.profile && ['veteran', 'admin'].includes(viewer.profile.role) && viewer.user.id !== profile.id && !wroteOne)) && (
            <section id="recommendations" className="card scroll-mt-24 p-7">
              <h2 className="font-sans text-lg font-semibold text-ink">Recommendations from fellow service members</h2>
              {searchParams.rec && <p className={`mt-2 text-sm ${searchParams.rec === 'sent' ? 'text-olive' : 'text-signal'}`}>{({ sent: 'Sent — it appears once they accept it.', short: 'Add how you know them and at least a couple of sentences.', exists: 'You’ve already recommended this member.', error: 'That didn’t send — please try again.' } as Record<string, string>)[searchParams.rec] ?? ''}</p>}
              {((myPendingRecs ?? []) as unknown as RecRow[]).map((r) => (
                <div key={r.id} className="mt-4 rounded-xl border border-brass bg-brass/10 p-4 text-sm">
                  <p><strong>{r.author?.full_name}</strong> · {r.relationship}</p><p className="mt-1 italic">“{r.body}”</p>
                  <div className="mt-3 flex gap-2">
                    <form action={decideRecommendation.bind(null, r.id, 'accepted', params.username)}><SubmitButton className="btn btn-primary py-1.5 text-xs" pendingText="…">Show on my profile</SubmitButton></form>
                    <form action={decideRecommendation.bind(null, r.id, 'hidden', params.username)}><SubmitButton className="btn btn-ghost border border-line py-1.5 text-xs" pendingText="…">Hide</SubmitButton></form>
                  </div>
                </div>
              ))}
              <ul className="mt-4 space-y-4">
                {((recs ?? []) as unknown as RecRow[]).map((r) => (
                  <li key={r.id} className="border-l-2 border-brass pl-4">
                    <p className="text-sm italic text-ink/85">“{r.body}”</p>
                    <p className="mt-1 text-xs text-muted">— {r.author?.username ? <Link href={`/veterans/${r.author.username}`} className="text-navy hover:underline">{r.author.full_name}</Link> : r.author?.full_name}{r.author?.verified && <VerifiedMark />} · {r.relationship}</p>
                  </li>
                ))}
              </ul>
              {viewer?.profile && ['veteran', 'admin'].includes(viewer.profile.role) && viewer.user.id !== profile.id && !wroteOne && (
                <details className="mt-4 text-sm"><summary className="cursor-pointer text-navy">Recommend {profile.full_name.split(' ')[0]}</summary>
                  <form action={writeRecommendation.bind(null, profile.id, params.username)} className="mt-3 space-y-2">
                    <input name="relationship" required maxLength={140} placeholder="How you know them (e.g. Served together, 2nd Bn 6th Marines, 2019–2021)" className="field" />
                    <textarea name="body" required rows={3} minLength={20} maxLength={2000} placeholder="What they’re like to serve or work with" className="field" />
                    <SubmitButton className="btn btn-primary" pendingText="Sending…">Send recommendation</SubmitButton>
                  </form>
                </details>
              )}
            </section>
          )}

          {(experience ?? []).length > 0 && (
            <section className="card p-7">
              <h2 className="font-sans text-lg font-semibold text-ink">Professional career</h2>
              <ul className="mt-4 space-y-5">
                {(experience ?? []).map((e: { id: string; company: string; position: string; start_date: string | null; end_date: string | null; description: string | null }) => (
                  <li key={e.id}>
                    <p className="font-serif text-xl font-semibold">{e.position}</p>
                    <p className="text-sm text-muted">{e.company} · {yearOf(e.start_date) || '—'}–{yearOf(e.end_date) || 'Present'}</p>
                    {e.description && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink/85">{e.description}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(education ?? []).length > 0 && (
            <section className="card p-7">
              <h2 className="font-sans text-lg font-semibold text-ink">Education</h2>
              <ul className="mt-4 space-y-3">
                {(education ?? []).map((e: { id: string; school: string; degree: string | null; field: string | null; graduation_year: number | null }) => (
                  <li key={e.id}>
                    <p className="font-medium">{e.school}</p>
                    <p className="text-sm text-muted">{[e.degree, e.field].filter(Boolean).join(', ')}{e.graduation_year ? ` · ${e.graduation_year}` : ''}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {translated.length > 0 && (
            <div className="card border-brass/40 p-6">
              <h2 className="font-sans text-base font-semibold text-ink">Civilian roles this service translates to</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {translated.map((c) => <span key={c} className="pill border-brass/40 bg-brass/10">{c}</span>)}
              </div>
            </div>
          )}
          <div className="card p-6">
            <h2 className="font-sans text-base font-semibold text-ink">Skills</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {skills.length === 0 ? <p className="text-sm text-muted">No skills listed yet.</p> : skills.map((s) => <span key={s} className="pill">{s}</span>)}
            </div>
          </div>
        </aside>
      </div>
      )}
    </>
  );
}

const ICON: Record<string, React.ReactNode> = {
  service: <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z" />,
  role: <><rect x="3.5" y="7.5" width="17" height="12" rx="2" /><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" /></>,
  place: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  move: <path d="M4 8h13l-3-3M20 16H7l3 3" />,
  people: <><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19.5c.6-3 2.8-4.7 5.5-4.7s4.9 1.7 5.5 4.7M15.5 5.6a2.8 2.8 0 0 1 0 5.6M17.6 14.9c1.3.7 2.2 2.2 2.4 4.6" /></>,
};

/** One line of the wall's Intro card: a small icon and its text. */
function IntroRow({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <svg viewBox="0 0 24 24" className="mt-px h-[18px] w-[18px] shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[icon]}</svg>
      <span className="min-w-0">{children}</span>
    </li>
  );
}
