import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import VerificationBadge from '@/components/VerificationBadge';
import { CLEARANCES, COMPONENTS, yearOf } from '@/lib/military';
import { initials } from '@/lib/format';
import { getFeed } from '@/lib/network';
import PostCard from '@/components/network/PostCard';
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

async function load(username: string) {
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
}

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const data = await load(params.username);
  if (!data || !data.vet) return { title: 'Profile', robots: { index: false } };
  return {
    title: data.profile.full_name,
    description: data.profile.headline ?? `${data.profile.full_name} on LanceNest`,
  };
}

export default async function VeteranProfilePage({ params, searchParams }: { params: { username: string }; searchParams: { rec?: string } }) {
  const data = await load(params.username);
  if (!data) notFound();
  const { supabase, profile } = data;
  const viewer = await getSessionProfile();
  if (viewer?.profile?.role === 'employer') {
    const { data: hiding } = await supabase.rpc('members_hiding_me');
    if (((hiding ?? []) as string[]).includes(profile.id)) notFound();
  }
  if (viewer?.profile?.role === 'veteran' && viewer.user.id !== profile.id) {
    const { data: me } = await supabase.from('veteran_profiles').select('verification_status').eq('profile_id', viewer.user.id).maybeSingle();
    if (me?.verification_status !== 'verified') redirect('/dashboard/verification?required=1');
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
  if (viewer && viewer.user.id !== profile.id) {
    await supabase.from('profile_views').insert({ profile_id: profile.id, viewer_id: viewer.user.id }).then(() => undefined, () => undefined);
  }

  const [{ data: service }, { data: skillRows }, { data: experience }, { data: education }, session] = await Promise.all([
    supabase.from('military_service').select('*, occupation:military_occupations(title, civilian_categories, civilian_skills)').eq('profile_id', profile.id).order('start_date', { ascending: false }),
    supabase.from('profile_skills').select('skill:skills(name)').eq('profile_id', profile.id),
    supabase.from('experience').select('*').eq('profile_id', profile.id).order('start_date', { ascending: false }),
    supabase.from('education').select('*').eq('profile_id', profile.id).order('graduation_year', { ascending: false }),
    getSessionProfile(),
  ]);

  const viewerId = session?.user.id ?? null;
  const [{ posts }, { count: followers }, { data: iFollow }] = await Promise.all([
    getFeed({ viewerId, authorId: profile.id, limit: 5 }),
    supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
    viewerId ? supabase.from('user_follows').select('following_id').eq('follower_id', viewerId).eq('following_id', profile.id) : Promise.resolve({ data: [] }),
  ]);
  const following = (iFollow ?? []).length > 0;
  const { data: verifiedWork } = viewer ? await supabase.rpc('verified_work', { p: profile.id }) : { data: [] };
  const [{ data: recs }, { data: myPendingRecs }, { data: mentorRow }, { data: wroteOne }] = await Promise.all([
    supabase.from('recommendations').select('id, relationship, body, created_at, author:profiles!recommendations_author_id_fkey(full_name, username, headline, verified)').eq('subject_id', profile.id).eq('status', 'accepted').order('created_at', { ascending: false }),
    viewer?.user?.id === profile.id ? supabase.from('recommendations').select('id, relationship, body, author:profiles!recommendations_author_id_fkey(full_name)').eq('subject_id', profile.id).eq('status', 'pending') : Promise.resolve({ data: [] }),
    supabase.from('mentor_profiles').select('available').eq('profile_id', profile.id).maybeSingle(),
    viewer?.user?.id && viewer.user.id !== profile.id ? supabase.from('recommendations').select('id').eq('author_id', viewer.user.id).eq('subject_id', profile.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const { data: offered } = await supabase.from('service_listings').select('id, title, category, price_cents, price_type, delivery, service_area').eq('profile_id', profile.id).eq('status', 'active').order('created_at', { ascending: false });
  type RecRow = { id: string; relationship: string; body: string; author: { full_name: string; username?: string | null; headline?: string | null; verified?: boolean } | null };
  const { data: reviews } = await supabase.from('reviews').select('rating, body, created_at').eq('reviewee_id', profile.id).order('created_at', { ascending: false }).limit(5);
  const avg = (reviews ?? []).length ? (reviews ?? []).reduce((a, r) => a + (r.rating as number), 0) / (reviews ?? []).length : 0;
  const [{ data: freelance }, { data: portfolio }] = await Promise.all([
    supabase.from('freelancer_profiles').select('title, bio, hourly_rate, available, clearance_work, vosb, sdvosb').eq('profile_id', profile.id).maybeSingle(),
    supabase.from('portfolio_items').select('id, title, description, url').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(6),
  ]);
  const services = (service ?? []) as unknown as Service[];
  const skills = ((skillRows ?? []) as unknown as { skill: { name: string } | null }[]).map((r) => r.skill?.name).filter(Boolean) as string[];
  const isOwner = session?.user.id === profile.id;
  const primary = services[0];
  const translated = Array.from(new Set(services.flatMap((s) => s.occupation?.civilian_categories ?? []))).slice(0, 8);
  const clearance = CLEARANCES.find(([v]) => v === vet.clearance_level)?.[1];

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page flex flex-col gap-6 py-12 sm:flex-row sm:items-center">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt={profile.full_name} className="h-24 w-24 shrink-0 rounded-full border-2 border-brass object-cover" />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-brass bg-navy font-serif text-3xl text-brass">
              {initials(profile.full_name)}
            </div>
          )}
          <div className="flex-1">
            <h1 className="font-serif text-4xl font-medium text-ivory sm:text-5xl">{profile.full_name}<PlanBadge plan={vet.plan} />{mentorRow?.available && <span className="ml-1.5 inline-block rounded-full border border-olive bg-olive/20 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-[0.1em] text-ivory">Mentor</span>}</h1>
            {profile.headline && <p className="mt-1 text-lg text-cream/85">{profile.headline}</p>}
            <p className="mt-2 text-sm text-cream/70">
              {[primary ? `${primary.branch}${primary.rank ? ` · ${primary.rank}` : ''}` : null, profile.location, vet.willing_to_relocate ? 'Open to relocation' : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <VerificationBadge status={vet.verification_status} />
              {clearance && vet.clearance_level !== 'none' && (isOwner || viewer?.profile?.role === 'employer' || viewer?.profile?.role === 'admin') && (
                <span className="inline-flex items-center rounded-full border border-brass/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brass">
                  {clearance} clearance
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            {isOwner ? (
              <Link href="/dashboard/profile" className="btn btn-brass">Edit profile</Link>
            ) : session ? (
              <div className="flex gap-2">
                <form action={(following ? unfollowUser : followUser).bind(null, profile.id)}>
                  <SubmitButton className={following ? 'btn border border-brass text-brass hover:bg-brass/10' : 'btn btn-brass'} pendingText="…">{following ? 'Following ✓' : 'Follow'}</SubmitButton>
                </form>
                <form action={startConversation.bind(null, profile.id)}>
                  <SubmitButton className="btn border border-cream/40 text-ivory hover:bg-white/10" pendingText="…">Message</SubmitButton>
                </form>
              </div>
            ) : (
              <Link href={`/login?next=/veterans/${profile.username}`} className="btn btn-brass">Log in to connect</Link>
            )}
            <p className="text-xs text-cream/70">{followers ?? 0} follower{followers === 1 ? '' : 's'}</p>
            {viewer?.profile?.role === 'employer' && (
              <details className="text-xs text-cream/70">
                <summary className="cursor-pointer hover:text-ivory">Save to talent pool</summary>
                <form action={saveToPool.bind(null, profile.id, `/veterans/${params.username}`)} className="mt-2 flex flex-col gap-2 text-ink">
                  <input name="list" placeholder="List name (e.g. Q1 cyber hires)" className="field py-2 text-sm" />
                  <textarea name="note" rows={2} maxLength={1000} placeholder="Private note (optional)" className="field py-2 text-sm" />
                  <SubmitButton className="btn border border-brass py-1.5 text-xs text-brass" pendingText="Saving…">Save</SubmitButton>
                </form>
              </details>
            )}
            {session && !isOwner && (
              <details className="text-xs text-cream/60">
                <summary className="cursor-pointer hover:text-ivory">Report this member</summary>
                <form action={reportContent.bind(null, 'profile', profile.id)} className="mt-2 flex flex-col gap-2 text-ink">
                  <select name="reason" required defaultValue="" className="field py-2 text-sm">
                    <option value="" disabled>Reason…</option>
                    <option value="harassment">Harassment or unprofessional conduct</option><option value="impersonation">Impersonation or false service claims</option>
                    <option value="fraud">Scam or fraud</option><option value="spam">Spam</option><option value="inappropriate">Inappropriate content</option><option value="sensitive_info">Shares SSN, personal info, or OPSEC-sensitive details</option><option value="other">Other</option>
                  </select>
                  <textarea name="details" rows={2} maxLength={1000} placeholder="What happened? (optional)" className="field py-2 text-sm" />
                  <SubmitButton className="btn btn-outline border-cream/40 py-1.5 text-xs text-ivory" pendingText="Sending…">Send report</SubmitButton>
                </form>
              </details>
            )}
          </div>
        </div>
      </section>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          {vet.about && (
            <section className="card p-7">
              <h2 className="eyebrow">About</h2>
              <p className="mt-3 whitespace-pre-line text-[16px] leading-relaxed text-ink/90">{vet.about}</p>
            </section>
          )}

          <section className="card p-7">
            <h2 className="eyebrow">Military career</h2>
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
                  <h2 className="eyebrow">Available for freelance</h2>
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
                    <li key={it.id as string} className="rounded-[4px] border border-line p-4">
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
                <h2 className="eyebrow">Verified work</h2>
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
              <h2 className="eyebrow">Services</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {(offered ?? []).map((sv) => (
                  <li key={sv.id as string}><Link href={`/freelance/services/${sv.id}`} className="block rounded-[4px] border border-line p-4 hover:border-brass">
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
              <h2 className="eyebrow">Recommendations from fellow service members</h2>
              {searchParams.rec && <p className={`mt-2 text-sm ${searchParams.rec === 'sent' ? 'text-olive' : 'text-signal'}`}>{({ sent: 'Sent — it appears once they accept it.', short: 'Add how you know them and at least a couple of sentences.', exists: 'You’ve already recommended this member.', error: 'That didn’t send — please try again.' } as Record<string, string>)[searchParams.rec] ?? ''}</p>}
              {((myPendingRecs ?? []) as unknown as RecRow[]).map((r) => (
                <div key={r.id} className="mt-4 rounded-[4px] border border-brass bg-brass/10 p-4 text-sm">
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

          <section id="posts" className="scroll-mt-24 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="eyebrow">Posts & milestones</h2>
              {isOwner && <Link href="/network" className="text-sm text-navy underline decoration-brass underline-offset-4">Share an update →</Link>}
            </div>
            {posts.length === 0 ? (
              <div className="card p-6 text-sm text-muted">{isOwner ? 'You haven’t shared anything yet.' : 'No posts to show yet.'}</div>
            ) : (
              posts.map((post) => <PostCard key={post.id} post={post} signedIn={!!session} />)
            )}
          </section>

          {(experience ?? []).length > 0 && (
            <section className="card p-7">
              <h2 className="eyebrow">Professional career</h2>
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
              <h2 className="eyebrow">Education</h2>
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

        <aside className="space-y-6">
          {translated.length > 0 && (
            <div className="card border-brass/40 p-6">
              <p className="eyebrow">Civilian roles this service translates to</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {translated.map((c) => <span key={c} className="pill border-brass/40 bg-brass/10">{c}</span>)}
              </div>
            </div>
          )}
          <div className="card p-6">
            <p className="eyebrow">Skills</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {skills.length === 0 ? <p className="text-sm text-muted">No skills listed yet.</p> : skills.map((s) => <span key={s} className="pill">{s}</span>)}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
