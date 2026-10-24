import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import VerificationBadge from '@/components/VerificationBadge';
import VerifiedNote from '@/components/VerifiedNote';
import { CLEARANCES, COMPONENTS, yearOf } from '@/lib/military';
import { ARRANGEMENT_LABELS, EMPLOYMENT_LABELS, initials } from '@/lib/format';
import { FEED_FILTERS, MILESTONES_BY_TYPE, PAGE_SIZE, POST_TYPES, VISIBILITY, getFeed, mediaUrl, type Post } from '@/lib/network';
import { searchJobs } from '@/lib/jobs';
import PostCard from '@/components/network/PostCard';
import Composer from '@/components/network/Composer';
import SubmitButton from '@/components/SubmitButton';
import { followUser, reportMember, unfollowUser } from '@/app/network/actions';
import { startConversation } from '@/app/messages/actions';
import Upsell from '@/components/employer/Upsell';
import PlanBadge from '@/components/PlanBadge';
import VerifiedMark from '@/components/VerifiedMark';
import { Bullets, Icon, SectionHead, StrengthRing } from '@/components/profile/ProfileParts';
import FlashNotice from '@/components/profile/FlashNotice';
import { DELIVERY_LABEL, PRICE_LABEL } from '@/lib/freelance';
import { saveToPool } from '@/app/employer/talent/actions';
import { decideRecommendation, writeRecommendation } from '@/app/network/recommendActions';
import type { JobWithCompany } from '@/lib/types';
import { safeHref } from '@/lib/safeHref';

type Profile = { id: string; full_name: string; username: string; headline: string | null; location: string | null; avatar_url: string | null };
type Vet = { plan?: string; about: string | null; clearance_level: string; verification_status: string; willing_to_relocate: boolean };
type Service = {
  id: string; branch: string; component: string; rank: string | null; occupation_code: string | null;
  start_date: string | null; end_date: string | null; deployments: number; duty_title: string | null; unit: string | null; description: string | null;
  occupation: { title: string; civilian_categories: string[]; civilian_skills: string[] } | null;
};
type Experience = { id: string; company: string; position: string; start_date: string | null; end_date: string | null; description: string | null };
type Education = { id: string; school: string; degree: string | null; field: string | null; graduation_year: number | null };

// Shared by the page title and the page itself: one lookup per request.
const load = cache(async (username: string) => {
  const supabase = await createClient();
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
    .select('about, clearance_level, verification_status, willing_to_relocate, plan, member_type')
    .eq('profile_id', profile.id)
    .maybeSingle();

  return { supabase, profile: profile as Profile, vet: (vet as Vet) ?? null };
});

export async function generateMetadata(props: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const params = await props.params;
  const data = await load(params.username);
  if (!data || !data.vet) return { title: 'Profile', robots: { index: false } };
  return {
    title: data.profile.full_name,
    description: data.profile.headline ?? `${data.profile.full_name} on LanceNest`,
  };
}

type Tab = 'profile' | 'posts' | 'photos';

export default async function VeteranProfilePage(
  props: { params: Promise<{ username: string }>; searchParams: Promise<{ rec?: string; tab?: string; type?: string; cursor?: string; pool?: string; reported?: string; saved?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
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
  const isOwner = viewerId === profile.id;
  const none = Promise.resolve({ data: null });
  // Overview (résumé + recent activity), Posts (the full wall), or Photos.
  const tab: Tab = searchParams.tab === 'posts' || searchParams.tab === 'photos' ? searchParams.tab : 'profile';
  const wallType = tab === 'posts' && FEED_FILTERS.some(([v]) => v && v === searchParams.type) ? searchParams.type : undefined;

  // Every section of the profile is independent: load them all in one round.
  const [
    ,
    { data: service }, { data: skillRows }, { data: experienceRows }, { data: educationRows },
    { posts, nextCursor }, { count: followers }, { data: iFollow },
    { data: verifiedWork },
    { data: recs }, { data: myPendingRecs }, { data: mentorRow }, { data: wroteOne },
    { data: offered }, { data: reviews },
    { data: freelance }, { data: portfolio },
    photoFeed, { count: postCount }, { count: resumeCount },
  ] = await Promise.all([
    // Count one profile view per visit, not one per section clicked.
    viewer && !isOwner && tab === 'profile'
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
    isOwner ? supabase.from('recommendations').select('id, relationship, body, author:profiles!recommendations_author_id_fkey(full_name)').eq('subject_id', profile.id).eq('status', 'pending') : Promise.resolve({ data: [] }),
    supabase.from('mentor_profiles').select('available').eq('profile_id', profile.id).maybeSingle(),
    viewerId && !isOwner ? supabase.from('recommendations').select('id').eq('author_id', viewerId).eq('subject_id', profile.id).maybeSingle() : none,
    supabase.from('service_listings').select('id, title, category, price_cents, price_type, delivery, service_area').eq('profile_id', profile.id).eq('status', 'active').order('created_at', { ascending: false }),
    supabase.from('reviews').select('rating, body, created_at').eq('reviewee_id', profile.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('freelancer_profiles').select('title, bio, hourly_rate, available, clearance_work, vosb, sdvosb').eq('profile_id', profile.id).maybeSingle(),
    supabase.from('portfolio_items').select('id, title, description, url, image_url').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(6),
    getFeed({ viewerId, authorId: profile.id, type: 'photos', limit: tab === 'photos' ? 48 : 6 }),
    // Row-level security counts only the posts this viewer is allowed to see.
    supabase.from('network_posts').select('id', { count: 'exact', head: true }).eq('author_id', profile.id).is('group_id', null),
    isOwner ? supabase.from('resumes').select('id', { count: 'exact', head: true }).eq('profile_id', profile.id) : Promise.resolve({ count: 0 }),
  ]);

  const following = (iFollow ?? []).length > 0;
  type RecRow = { id: string; relationship: string; body: string; author: { full_name: string; username?: string | null; headline?: string | null; verified?: boolean } | null };
  const avg = (reviews ?? []).length ? (reviews ?? []).reduce((a, r) => a + (r.rating as number), 0) / (reviews ?? []).length : 0;
  const services = (service ?? []) as unknown as Service[];
  const experience = (experienceRows ?? []) as Experience[];
  const education = (educationRows ?? []) as Education[];
  const { verifiedCredentials } = await import('@/lib/credentials');
  const credentials = await verifiedCredentials(profile.id);
  const skills = ((skillRows ?? []) as unknown as { skill: { name: string } | null }[]).map((r) => r.skill?.name).filter(Boolean) as string[];
  const primary = services[0];
  const translated = Array.from(new Set(services.flatMap((s) => s.occupation?.civilian_categories ?? []))).slice(0, 8);
  const clearance = CLEARANCES.find(([v]) => v === vet.clearance_level)?.[1];
  const first = profile.full_name.split(' ')[0];
  const base = `/veterans/${profile.username}`;
  const edit = (anchor: string) => (isOwner ? `/dashboard/profile#${anchor}` : null);

  // Service facts shown in the header, the left card and the service banner.
  const status = !primary ? 'Service member' : primary.end_date ? 'Veteran' : (COMPONENTS.find(([v]) => v === primary.component)?.[1] ?? 'Service member');
  const branch = primary ? `U.S. ${primary.branch}` : null;
  const yearsServed = Math.round(services.reduce((a, s) => {
    const st = s.start_date ? Date.parse(s.start_date) : NaN;
    const en = s.end_date ? Date.parse(s.end_date) : Date.now();
    return Number.isFinite(st) ? a + Math.max(0, en - st) : a;
  }, 0) / (365.25 * 864e5));
  const deployments = services.reduce((a, s) => a + (s.deployments || 0), 0);

  // Experience: military service and civilian jobs in one timeline, newest first.
  type Entry = { key: string; kind: 'military' | 'civilian'; org: string; role: string | null; detail: string | null; start: string | null; end: string | null; description: string | null; extra: string | null };
  const entries: Entry[] = [
    ...services.map((s) => ({
      key: `m-${s.id}`, kind: 'military' as const, org: `U.S. ${s.branch}`,
      role: s.duty_title || s.occupation?.title || null,
      detail: [s.rank, s.occupation_code && s.occupation ? `${s.occupation_code} · ${s.occupation.title}` : s.occupation_code, COMPONENTS.find(([v]) => v === s.component)?.[1], s.unit, s.deployments > 0 ? `${s.deployments} deployment${s.deployments > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ') || null,
      start: s.start_date, end: s.end_date, description: s.description,
      extra: s.occupation && s.occupation.civilian_skills.length ? s.occupation.civilian_skills.join(' · ') : null,
    })),
    ...experience.map((e) => ({ key: `c-${e.id}`, kind: 'civilian' as const, org: e.company, role: e.position, detail: null, start: e.start_date, end: e.end_date, description: e.description, extra: null })),
  ].sort((a, b) => (Date.parse(b.start ?? '') || 0) - (Date.parse(a.start ?? '') || 0));

  // Owner-only: Profile Strength and jobs that fit their background.
  const checks: [string, boolean, string][] = [
    ['Profile photo', !!profile.avatar_url, 'photo'],
    ['About you', !!vet.about, 'about'],
    ['Military career', services.length > 0, 'service'],
    ['Work experience', experience.length > 0, 'experience'],
    ['Education', education.length > 0, 'education'],
    ['Skills', skills.length >= 3, 'skills'],
    ['Résumé uploaded', (resumeCount ?? 0) > 0, 'resume'],
  ];
  const strength = Math.round((checks.filter(([, done]) => done).length / checks.length) * 100);
  const nextFix = checks.find(([, done]) => !done)?.[2];
  let recJobs: JobWithCompany[] = [];
  if (isOwner) {
    try {
      recJobs = translated[0] ? await searchJobs({ q: translated[0] }, 3) : [];
      if (!recJobs.length) recJobs = await searchJobs({}, 3);
    } catch { recJobs = []; }
  }

  // Posting needs a verified account (the database enforces this too); admins can always post.
  const canPost = isOwner && (viewer?.profile?.role === 'admin' || vet.verification_status === 'verified');
  const tabHref = (t: Tab, extra: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams();
    if (t !== 'profile') p.set('tab', t);
    Object.entries(extra).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    // Land at the top of the profile content, not wherever the page happened to be scrolled.
    return `${base}${s ? `?${s}` : ''}#profile-content`;
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

  const nav: [string, string, string, string][] = [
    ['overview', 'Overview', 'overview', tabHref('profile')],
    ['experience', 'Experience', 'experience', `${base}#experience`],
    ['education', 'Education', 'education', `${base}#education`],
    ['skills', 'Skills', 'skills', `${base}#skills`],
    ['posts', `Posts${postCount ? ` (${postCount})` : ''}`, 'posts', tabHref('posts')],
    ['photos', 'Photos', 'photos', tabHref('photos')],
    ...(isOwner ? [['resume', 'Résumé', 'resume', '/dashboard/profile#resume'], ['settings', 'Settings', 'settings', '/settings/account']] as [string, string, string, string][] : []),
  ];
  const activeNav = tab === 'profile' ? 'overview' : tab;

  // One-line confirmation after an action on this page (report, talent pool, recommendation).
  const flash: { text: string; ok: boolean; link?: [string, string] } | null =
    isOwner && searchParams.saved === '1' ? { text: 'Your profile was saved.', ok: true, link: ['Keep editing', '/dashboard/profile'] }
    : searchParams.reported === '1' ? { text: 'Thanks. Your report was received, and our team will review it.', ok: true }
    : searchParams.reported === 'error' ? { text: 'Your report didn’t send. Please try again.', ok: false }
    : searchParams.pool === 'saved' ? { text: `${first} was saved to your talent pool.`, ok: true, link: ['Open talent pool', '/employer/talent'] }
    : searchParams.pool === 'upgrade' ? { text: 'Talent pools are included with the Professional, Federal and Enterprise plans.', ok: false, link: ['Compare plans', '/employers'] }
    : searchParams.rec === 'sent' ? { text: `Recommendation sent. It appears on ${first}’s profile once they accept it.`, ok: true }
    : searchParams.rec === 'exists' ? { text: `You’ve already recommended ${first}.`, ok: false }
    : searchParams.rec === 'short' ? { text: 'Your recommendation wasn’t sent. Add how you know them and at least a couple of sentences.', ok: false, link: ['Try again', `${base}#recommendations`] }
    : searchParams.rec === 'error' ? { text: 'Your recommendation didn’t send. Please try again.', ok: false, link: ['Try again', `${base}#recommendations`] }
    : null;

  return (
    <>
      {/* Banner: the harbor photo with the member's name (and a welcome on your own profile). */}
      <section className="relative overflow-hidden bg-navy-deep text-ivory">
        <Image src="/assets/lighthouse.webp" alt="" fill priority quality={85} sizes="100vw" className="object-cover object-[center_62%]" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-deep/95 via-navy-deep/70 to-navy-deep/10" aria-hidden="true" />
        <div className="container-page relative py-10 sm:py-14">
          {isOwner && <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cream/85">Welcome back,</p>}
          <h1 className="mt-2 font-serif text-4xl font-medium leading-tight text-ivory sm:text-6xl">{profile.full_name}</h1>
          <p className="mt-3 text-base text-cream/90 sm:text-lg">{[status, branch, profile.headline].filter(Boolean).join('  ·  ')}</p>
          <div className="mt-5 flex items-center gap-2 text-brass" aria-hidden="true"><span className="h-px w-16 bg-brass/70" /><span className="text-[10px]">✦</span><span className="h-px w-16 bg-brass/70" /></div>
          {isOwner && <p className="mt-4 max-w-md font-serif text-lg italic leading-snug text-cream/90 sm:text-xl">Same mission. New battlefield.<br />Your next chapter starts here.</p>}
        </div>
      </section>

      {flash && (
        <div id="notice" className="container-page scroll-mt-24 pt-6">
          <FlashNotice text={flash.text} ok={flash.ok} link={flash.link} />
        </div>
      )}

      <div className="container-page grid grid-cols-[minmax(0,1fr)] items-start gap-6 py-8 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        {/* ---------- Left: identity card and section menu ---------- */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24">
          <div className="card p-6 text-center">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={profile.full_name} className="mx-auto h-36 w-36 rounded-full border-4 border-ivory object-cover shadow-md ring-2 ring-brass/50" />
            ) : (
              <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full border-4 border-ivory bg-navy font-serif text-5xl text-brass shadow-md ring-2 ring-brass/50">{initials(profile.full_name)}</div>
            )}
            <p className="mt-4 font-serif text-[28px] font-semibold leading-tight text-ink">{profile.full_name}</p>
            <p className="mt-1 text-sm text-muted">{[status, primary?.branch].filter(Boolean).join(' · ')}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              <VerificationBadge status={vet.verification_status} spouse={(vet as { member_type?: string }).member_type === 'spouse'} />
              <PlanBadge plan={vet.plan} />
              {mentorRow?.available && <span className="inline-block rounded-full border border-olive bg-olive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-olive">Mentor</span>}
              {clearance && vet.clearance_level !== 'none' && (isOwner || viewer?.profile?.role === 'employer' || viewer?.profile?.role === 'admin') && (
                <span className="inline-flex items-center rounded-full border border-brass/60 bg-brass/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brass-dark">{clearance} clearance</span>
              )}
            </div>
            {(profile.location || vet.willing_to_relocate) && (
              <p className="mt-3 inline-flex items-start gap-1.5 text-left text-sm text-ink/85">
                <Icon name="pin" className="mt-0.5 h-4 w-4 text-muted" />
                <span>{profile.location ?? 'Location not listed'}{vet.willing_to_relocate && <span className="block text-xs text-muted">Open to relocation</span>}</span>
              </p>
            )}
            <div className="mt-5 grid grid-cols-3 divide-x divide-line/80 border-y border-line/80 py-3">
              <div className="px-1"><p className="font-serif text-2xl text-ink">{yearsServed || '—'}</p><p className="text-[10px] leading-tight text-muted">Years served</p></div>
              <div className="px-1"><p className="font-serif text-2xl text-ink">{deployments}</p><p className="text-[10px] leading-tight text-muted">Deployments</p></div>
              <div className="px-1"><p className="font-serif text-2xl text-ink">{followers ?? 0}</p><p className="text-[10px] leading-tight text-muted">Followers</p></div>
            </div>
            <div className="mt-5 space-y-2">
              {isOwner ? (
                <Link href="/dashboard/profile" className="btn btn-primary w-full"><Icon name="pencil" className="h-4 w-4" /> Edit profile</Link>
              ) : session ? (
                <>
                  <form action={(following ? unfollowUser : followUser).bind(null, profile.id)}>
                    <SubmitButton className={`btn w-full ${following ? 'btn-outline' : 'btn-primary'}`} pendingText="…">{following ? 'Following ✓' : '+ Follow'}</SubmitButton>
                  </form>
                  <form action={startConversation.bind(null, profile.id)}>
                    <SubmitButton className="btn btn-outline w-full" pendingText="…">Message</SubmitButton>
                  </form>
                </>
              ) : (
                <Link href={`/login?next=${base}`} className="btn btn-primary w-full">Log in to connect</Link>
              )}
            </div>
            {vet.verification_status === 'verified' && (viewer?.profile?.role === 'employer' || viewer?.profile?.role === 'admin') && (
              <p className="mt-3 text-left text-[11px] leading-relaxed text-muted"><VerifiedNote /></p>
            )}
            {(viewer?.profile?.role === 'employer' || (session && !isOwner)) && (
              <div className="mt-4 space-y-2 border-t border-line/80 pt-3 text-left">
                {viewer?.profile?.role === 'employer' && (
                  <details className="text-sm text-muted">
                    <summary className="cursor-pointer font-medium text-navy hover:underline">Save to talent pool</summary>
                    <form action={saveToPool.bind(null, profile.id, base)} className="mt-2 flex flex-col gap-2 text-ink">
                      <input name="list" placeholder="List name (e.g. Q1 cyber hires)" className="field py-2 text-sm" />
                      <textarea name="note" rows={2} maxLength={1000} placeholder="Private note (optional)" className="field py-2 text-sm" />
                      <SubmitButton className="btn btn-outline py-1.5 text-xs" pendingText="Saving…">Save</SubmitButton>
                    </form>
                  </details>
                )}
                {session && !isOwner && (
                  <details className="text-sm text-muted">
                    <summary className="cursor-pointer hover:text-ink">Report this member</summary>
                    <form action={reportMember.bind(null, profile.id, profile.username)} className="mt-2 flex flex-col gap-2 text-ink">
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
          </div>

          <nav aria-label="Profile sections" className="card flex gap-1 overflow-x-auto p-2 lg:block">
            {nav.map(([key, label, icon, href]) => {
              const on = activeNav === key;
              return (
                <Link key={key} href={href} aria-current={on ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors lg:gap-3 lg:border-l-[3px] lg:py-2.5 ${on ? 'bg-paper font-semibold text-ink lg:border-navy' : 'text-ink/80 hover:bg-paper/70 hover:text-ink lg:border-transparent'}`}>
                  <Icon name={icon} className="h-[18px] w-[18px] text-ink/70" />{label}
                </Link>
              );
            })}
          </nav>
          {isOwner && <p className="hidden px-2 text-center text-xs text-muted lg:block">This is how employers and members see your profile.</p>}
        </aside>

        {/* ---------- Center ---------- */}
        <div id="profile-content" className="min-w-0 scroll-mt-24 space-y-6">
          {tab === 'profile' && (
            <>
              {/* Service banner */}
              <section className="relative overflow-hidden rounded-2xl bg-navy-deep text-ivory shadow-sm">
                <div className="absolute inset-0 opacity-[0.09] [background-image:repeating-linear-gradient(180deg,#e8dcc2_0_14px,transparent_14px_28px)]" aria-hidden="true" />
                <div className="absolute inset-y-0 left-0 w-2/5 opacity-25 [background-image:radial-gradient(circle,#e8dcc2_1.3px,transparent_1.8px)] [background-size:24px_24px]" aria-hidden="true" />
                <div className="absolute inset-0 bg-gradient-to-r from-navy-deep/30 via-navy-deep/75 to-navy-deep/30" aria-hidden="true" />
                <div className="relative px-6 py-10 text-center sm:py-12">
                  <p className="font-serif text-sm uppercase tracking-[0.4em] text-cream/90">{status}</p>
                  <p className="mt-1 font-serif text-2xl uppercase tracking-[0.18em] text-ivory sm:text-3xl">{branch ?? 'Service member'}</p>
                  <div className="mx-auto mt-4 flex max-w-xs items-center justify-center gap-3 text-brass" aria-hidden="true"><span className="h-px flex-1 bg-cream/40" /><span>★</span><span className="h-px flex-1 bg-cream/40" /></div>
                  {primary && (primary.rank || primary.occupation) && (
                    <p className="mt-4 text-sm text-cream/80">{[primary.rank, primary.occupation?.title].filter(Boolean).join(' · ')}</p>
                  )}
                  <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-cream/70 sm:text-[11px] sm:tracking-[0.32em]">Service · Leadership · What’s next</p>
                </div>
              </section>

              {/* Freelancers lead with their work (like Contra), ahead of the résumé. */}
              {freelance && (portfolio ?? []).length > 0 && (
                <section className="card p-6 sm:p-8">
                  <SectionHead title="Work samples" />
                    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                      {(portfolio ?? []).map((it) => (
                        <li key={it.id as string} className="overflow-hidden rounded-xl border border-line">
                          {it.image_url && <img src={it.image_url as string} alt={it.title as string} className="aspect-[4/3] w-full object-cover" loading="lazy" />}
                          <div className="p-4">
                          <p className="font-medium">{it.title as string}</p>
                          {it.description && <p className="mt-1 text-sm text-muted">{it.description as string}</p>}
                          {safeHref(it.url as string) && <a href={safeHref(it.url as string)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-navy underline">View work ↗</a>}
                          </div>
                        </li>
                      ))}
                    </ul>
                </section>
              )}

              <div className="card space-y-8 p-6 sm:p-8">
                <section>
                  <SectionHead id="about" title="About me" edit={edit('about')} />
                  {vet.about ? (
                    <p className="mt-4 whitespace-pre-line text-[16px] leading-relaxed text-ink/90">{vet.about}</p>
                  ) : (
                    <p className="mt-4 text-sm text-muted">{isOwner ? 'Tell employers who you are and what you’re looking for next.' : 'No summary yet.'}</p>
                  )}
                </section>

                <section>
                  <SectionHead id="experience" title="Work experience" edit={edit('service')} />
                  {entries.length === 0 ? (
                    <p className="mt-4 text-sm text-muted">{isOwner ? 'Add your military career and civilian jobs.' : 'No experience added yet.'}</p>
                  ) : (
                    <ul className="divide-y divide-line/70">
                      {entries.map((e) => (
                        <li key={e.key} className="flex gap-4 py-5">
                          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${e.kind === 'military' ? 'bg-navy text-brass' : 'bg-paper text-navy'}`}>
                            <Icon name={e.kind === 'military' ? 'shield' : 'experience'} className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-serif text-xl font-semibold text-ink">{e.org}</p>
                            <p className="text-sm text-muted">{yearOf(e.start) || '—'} – {yearOf(e.end) || 'Present'}</p>
                            {e.role && <p className="mt-0.5 font-medium text-ink/90">{e.role}</p>}
                            {e.detail && <p className="text-sm text-muted">{e.detail}</p>}
                            <Bullets text={e.description} />
                            {e.extra && <p className="mt-2 text-sm text-navy">{e.extra}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <SectionHead id="education" title="Education" edit={edit('education')} />
                  {education.length === 0 ? (
                    <p className="mt-4 text-sm text-muted">{isOwner ? 'Add schools, degrees, and training.' : 'No education added yet.'}</p>
                  ) : (
                    <ul className="divide-y divide-line/70">
                      {education.map((e) => (
                        <li key={e.id} className="flex gap-4 py-5">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-paper text-navy"><Icon name="education" className="h-5 w-5" /></span>
                          <div>
                            <p className="font-serif text-xl font-semibold text-ink">{e.school}</p>
                            {(e.degree || e.field) && <p className="text-ink/90">{[e.degree, e.field].filter(Boolean).join(' in ')}</p>}
                            {e.graduation_year && <p className="text-sm text-muted">{e.graduation_year}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <SectionHead id="skills" title="Skills & expertise" edit={edit('skills')} />
                  {skills.length === 0 ? (
                    <p className="mt-4 text-sm text-muted">{isOwner ? 'Add at least three skills so employers can find you.' : 'No skills listed yet.'}</p>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">{skills.map((s) => <span key={s} className="rounded-full border border-line px-3.5 py-1.5 text-sm text-ink/85">{s}</span>)}</div>
                  )}
                </section>

                {credentials.length > 0 && (
                  <section>
                    <SectionHead id="credentials" title="Verified licenses & certificates" />
                    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                      {credentials.map((c) => (
                        <li key={c.id} className="rounded-xl border border-olive/30 bg-olive/5 px-4 py-3 text-sm">
                          <p className="font-medium text-ink">✓ {c.name}</p>
                          <p className="text-xs text-muted">{[c.kind === 'license' ? `${c.trade} license` : 'Certificate', c.state, c.issuer].filter(Boolean).join(' · ')}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>

              {freelance && (
                <section className="card border-brass/40 p-6 sm:p-8">
                  <SectionHead title="Available for freelance" />
                  <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                    <p className="font-serif text-2xl text-navy">{freelance.title as string}</p>
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
                </section>
              )}

              {((verifiedWork ?? []) as unknown[]).length > 0 && (
                <section className="card p-6 sm:p-8">
                  <SectionHead title="Verified work" />
                  <p className="mt-3 inline-block rounded-full border border-olive/40 bg-olive/10 px-3 py-1 text-[11px] font-semibold text-olive">✓ Completed and paid through LanceNest</p>
                  <ul className="mt-2 divide-y divide-line">
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
                <section className="card p-6 sm:p-8">
                  <SectionHead title="Services" />
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

              {(((recs ?? []) as unknown as RecRow[]).length > 0 || ((myPendingRecs ?? []) as unknown[]).length > 0 || (viewer?.profile && ['veteran', 'admin'].includes(viewer.profile.role) && !isOwner && !wroteOne)) && (
                <section id="recommendations" className="card scroll-mt-24 p-6 sm:p-8">
                  <SectionHead title="Recommendations" />
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
                  {viewer?.profile && ['veteran', 'admin'].includes(viewer.profile.role) && !isOwner && !wroteOne && (
                    <details className="mt-4 text-sm"><summary className="cursor-pointer text-navy">Recommend {first}</summary>
                      <form action={writeRecommendation.bind(null, profile.id, params.username)} className="mt-3 space-y-2">
                        <input name="relationship" required maxLength={140} placeholder="How you know them (e.g. Served together, 2nd Bn 6th Marines, 2019–2021)" className="field" />
                        <textarea name="body" required rows={3} minLength={20} maxLength={2000} placeholder="What they’re like to serve or work with" className="field" />
                        <SubmitButton className="btn btn-primary" pendingText="Sending…">Send recommendation</SubmitButton>
                      </form>
                    </details>
                  )}
                </section>
              )}

              <section id="activity" className="scroll-mt-24 space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-[15px] font-semibold uppercase tracking-[0.22em] text-ink">Activity</h2>
                    <p className="text-sm text-muted">{postCount ?? 0} post{postCount === 1 ? '' : 's'}</p>
                  </div>
                  {!!postCount && <Link href={tabHref('posts')} className="text-sm font-semibold text-navy hover:underline">Show all posts →</Link>}
                </div>
                {composer}
                {posts.length === 0 ? emptyWall : posts.map((post) => <PostCard key={post.id} post={post} signedIn={!!session} />)}
              </section>
            </>
          )}

          {tab === 'posts' && (
            <>
              {!wallType && !searchParams.cursor && composer}
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                {FEED_FILTERS.map(([v, label]) => (
                  <Link key={label} href={tabHref('posts', { type: v || undefined })}
                    className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm ${(wallType ?? '') === v ? 'border-navy bg-navy text-ivory' : 'border-line bg-ivory text-ink hover:border-brass'}`}>
                    {label}
                  </Link>
                ))}
              </div>
              {posts.length === 0 && !searchParams.cursor
                ? (wallType ? <div className="card p-6 text-sm text-muted">Nothing in this category yet.</div> : emptyWall)
                : posts.map((post) => <PostCard key={post.id} post={post} signedIn={!!session} />)}
              {nextCursor && (
                <div className="text-center"><Link href={tabHref('posts', { type: wallType, cursor: nextCursor })} className="btn btn-outline">Load older posts</Link></div>
              )}
              {searchParams.cursor && !nextCursor && posts.length > 0 && <p className="text-center text-sm text-muted">That’s everything {isOwner ? 'you’ve' : `${first} has`} posted.</p>}
            </>
          )}

          {tab === 'photos' && (
            <section className="card p-6 sm:p-8">
              <SectionHead title="Photos" />
              {photos.length === 0 ? (
                <p className="mt-4 text-sm text-muted">{isOwner ? 'Add photos to a post and they’ll appear here.' : `${first} hasn’t shared any photos yet.`}</p>
              ) : (
                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {photos.map((ph) => (
                    <Link key={ph.src} href={`/network/${ph.postId}`} className="block aspect-square overflow-hidden rounded-xl bg-paper">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ph.src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]" />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* ---------- Right ---------- */}
        <aside className="min-w-0 space-y-4 lg:col-start-2 xl:col-start-auto">
          {isOwner && (
            <>
              <div className="card p-6">
                <h2 className="font-serif text-xl font-semibold text-ink">Profile strength</h2>
                <div className="mt-4"><StrengthRing pct={strength} /></div>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {checks.map(([label, done]) => (
                    <li key={label} className="flex items-center gap-2.5">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${done ? 'bg-[#2f7a3e] text-white' : 'border border-line text-transparent'}`} aria-hidden="true">✓</span>
                      <span className={done ? 'text-ink' : 'text-muted'}>{label}</span>
                      <span className="sr-only">{done ? 'done' : 'not done'}</span>
                    </li>
                  ))}
                </ul>
                {strength < 100
                  ? <Link href={`/dashboard/profile${nextFix ? `#${nextFix}` : ''}`} className="btn btn-primary mt-5 w-full">Improve profile</Link>
                  : <p className="mt-5 text-center text-sm font-medium text-olive">Your profile is complete.</p>}
              </div>

              <div className="card p-6">
                <h2 className="font-serif text-xl font-semibold text-ink">Quick actions</h2>
                <ul className="mt-3 divide-y divide-line/70 text-sm">
                  {([['resume', 'Upload résumé', '/dashboard/profile#resume'], ['search', 'Browse jobs', '/jobs'], ['bell', 'Set job alerts', '/dashboard/alerts'], ['clipboard', 'My applications', '/dashboard/applications'], ['people', 'Networking', '/people']] as const).map(([icon, label, href]) => (
                    <li key={label}><Link href={href} className="flex items-center gap-3 py-3 text-ink/90 hover:text-navy"><Icon name={icon} className="h-5 w-5 text-ink/70" />{label}</Link></li>
                  ))}
                </ul>
              </div>

              {recJobs.length > 0 && (
                <div className="card p-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-serif text-xl font-semibold text-ink">Recommended jobs</h2>
                    <Link href="/jobs" className="text-xs font-semibold text-navy hover:underline">View all →</Link>
                  </div>
                  <ul className="mt-3 divide-y divide-line/70">
                    {recJobs.map((j) => (
                      <li key={j.id}>
                        <Link href={`/jobs/${j.slug}`} className="group flex items-start gap-3 py-3">
                          {j.company?.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={j.company.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-line object-cover" />
                          ) : (
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-navy font-serif text-sm text-brass">{initials(j.company?.name ?? 'Job')}</span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-ink group-hover:text-navy">{j.title}</span>
                            <span className="block truncate text-xs text-muted">{j.company?.name}</span>
                            <span className="mt-1 flex items-center gap-1 text-xs text-muted"><Icon name="pin" className="h-3.5 w-3.5" />{j.location || ARRANGEMENT_LABELS[j.work_arrangement]}</span>
                            <span className="flex items-center gap-1 text-xs text-muted"><Icon name="clock" className="h-3.5 w-3.5" />{EMPLOYMENT_LABELS[j.employment_type]}</span>
                          </span>
                          <Icon name="chevron" className="mt-1 h-4 w-4 text-muted" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="relative overflow-hidden rounded-2xl text-ivory">
                <Image src="/assets/harbor-still-life.webp" alt="" fill sizes="300px" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-navy-deep/90 via-navy-deep/75 to-navy-deep/60" aria-hidden="true" />
                <div className="relative p-6">
                  <p className="font-serif text-2xl leading-snug">More than a job.<br />A mission.</p>
                  <p className="mt-2 text-sm text-cream/85">Connect with employers who value your service.</p>
                  <Link href="/jobs" className="btn btn-brass mt-4">Explore jobs →</Link>
                </div>
              </div>
            </>
          )}

          {!isOwner && translated.length > 0 && (
            <div className="card p-6">
              <h2 className="font-serif text-lg font-semibold text-ink">Civilian roles this service translates to</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {translated.map((c) => <span key={c} className="pill border-brass/40 bg-brass/10">{c}</span>)}
              </div>
            </div>
          )}

          {tab !== 'photos' && photos.length > 0 && (
            <div className="card p-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-lg font-semibold text-ink">Photos</h2>
                <Link href={tabHref('photos')} className="text-xs font-semibold text-navy hover:underline">See all</Link>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-1.5 overflow-hidden rounded-xl">
                {photos.slice(0, 6).map((ph) => (
                  <Link key={ph.src} href={`/network/${ph.postId}`} className="block aspect-square bg-paper">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ph.src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-opacity hover:opacity-90" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
