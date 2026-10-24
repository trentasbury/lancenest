import type { Metadata } from 'next';
import Link from 'next/link';
import MemberPerks from '@/components/MemberPerks';
import RecommendedJobs from '@/components/RecommendedJobs';
import ProfileStrength from '@/components/ProfileStrength';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import VerificationBadge from '@/components/VerificationBadge';
import JobCard from '@/components/JobCard';
import { searchJobs } from '@/lib/jobs';
import { postedAgo } from '@/lib/format';
import { cookies } from 'next/headers';
import PartnerCodeForm from '@/components/PartnerCodeForm';
import ShareMoment from '@/components/ShareMoment';

export const metadata: Metadata = { title: 'Dashboard' };

const TOOLS = [
  { href: '/dashboard/applications', label: 'My applications', hint: 'Track every job you’ve applied to' },
  { href: '/dashboard/alerts', label: 'Job alerts', hint: 'New matches sent to your inbox' },
  { href: '/dashboard/resume-builder', label: 'Résumé builder', hint: 'Turn your service into a civilian résumé' },
  { href: '/dashboard/resume-writer', label: 'AI résumé writer', hint: 'Your MOS and evals in civilian words' },
  { href: '/training', label: 'Training & certifications', hint: 'Programs for GI Bill and SkillBridge' },
  { href: '/groups', label: 'Groups', hint: 'Connect by branch, field, and location' },
  { href: '/mentors', label: 'Mentors', hint: 'Advice from members who’ve made the move' },
  { href: '/fairs', label: 'Career fairs', hint: 'Virtual hiring events' },
  { href: '/freelance/earnings', label: 'Freelance earnings', hint: 'Contracts and payouts' },
  { href: '/dashboard/credentials', label: 'Licenses & certificates', hint: 'Verified badges; unlock trade work' },
];

type AppRow = { id: string; status: string; applied_at: string; job: { title: string; slug: string } | null };

export default async function VeteranDashboard(props: { searchParams: Promise<{ boost?: string; spouse?: string; code?: string }> }) {
  const searchParams = await props.searchParams;
  const { user, profile } = await requireRole(['veteran'], '/dashboard');
  const supabase = await createClient();

  const [{ data: vet }, { count: savedCount }, { data: apps }, latestJobs, { data: lastReview }] = await Promise.all([
    supabase.from('veteran_profiles').select('verification_status, member_type').eq('profile_id', user.id).maybeSingle(),
    supabase.from('saved_jobs').select('job_id', { count: 'exact', head: true }).eq('profile_id', user.id),
    supabase
      .from('applications')
      .select('id, status, applied_at, job:jobs(title, slug)')
      .eq('profile_id', user.id)
      .order('applied_at', { ascending: false })
      .limit(5),
    searchJobs({}, 3),
    supabase.from('verification_requests').select('reviewed_at').eq('profile_id', user.id).eq('status', 'verified').order('reviewed_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const partnerCode = (await cookies()).get('ln_partner')?.value;
  const newlyVerified = !!lastReview?.reviewed_at && Date.now() - Date.parse(lastReview.reviewed_at as string) < 14 * 86400000;

  const applications = (apps ?? []) as unknown as AppRow[];
  const firstName = profile.full_name.split(' ')[0] || 'there';
  const spouse = vet?.member_type === 'spouse';

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page flex flex-col gap-5 py-12 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow text-brass">Welcome back</p>
            <h1 className="mt-3 font-serif text-5xl font-medium text-ivory">Welcome back, {firstName}.</h1>
            <p className="mt-2 font-serif text-xl italic text-cream/85">Your next mission is waiting.</p>
          </div>
          <VerificationBadge status={vet?.verification_status ?? 'not_verified'} spouse={spouse} />
        </div>
      </section>

      <div className="container-page space-y-10 py-10">
        {searchParams.spouse && vet?.verification_status === 'verified' && <p className="rounded-xl border border-olive/40 bg-olive/10 px-4 py-3 text-sm text-olive">✓ You’re verified as a military spouse. Everything on LanceNest is unlocked.</p>}
        {vet?.verification_status === 'verified' && (partnerCode || searchParams.code) && <PartnerCodeForm back="/dashboard" result={searchParams.code} prefill={partnerCode} />}
        {vet?.verification_status === 'verified' && newlyVerified && <ShareMoment title="You’re verified." body="Let your network know you’re on LanceNest, the verified network for people who served." />}
        {vet?.verification_status === 'verified' && <MemberPerks userId={user.id} boost={searchParams.boost} />}
        {vet?.verification_status === 'verified' && <RecommendedJobs limit={4} title="Jobs for you" />}
        <ProfileStrength userId={user.id} />

        {vet?.verification_status !== 'verified' && (
          <div className="card flex flex-col gap-3 border-brass p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{vet?.verification_status === 'pending' ? 'Your verification is being reviewed.' : spouse ? 'Verify as a military spouse to unlock LanceNest.' : 'Verify your service to unlock LanceNest.'}</p>
              <p className="text-sm text-muted">{vet?.verification_status === 'pending' ? 'Jobs, the network, and messaging unlock the moment a reviewer approves your document.' : spouse ? 'Accept an invite from your verified service member, or send one document. It’s free.' : 'Jobs, the network, messaging, and employer visibility are for verified service members. It’s free and takes two minutes to submit.'}</p>
            </div>
            {vet?.verification_status !== 'pending' && <Link href="/dashboard/verification" className="btn btn-brass shrink-0">Verify now</Link>}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/dashboard/profile" className="card card-hover group p-5">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Your profile</p>
            <p className="mt-2 font-serif text-2xl text-navy">{profile.onboarding_completed ? 'Edit profile' : 'Build your profile'} →</p>
            <p className="mt-1 text-xs text-muted">Name, about, skills, service, experience</p>
          </Link>
          <Link href="/dashboard/verification" className="card card-hover group p-5">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Verification</p>
            <p className="mt-2 font-serif text-2xl text-navy">{vet?.verification_status === 'verified' ? 'Verified ✦' : 'Get verified'} →</p>
            <p className="mt-1 text-xs text-muted">{spouse ? 'Earn the Verified Military Spouse badge' : 'Earn the Verified Veteran badge'}</p>
          </Link>
          {profile.username && (
            <Link href={`/veterans/${profile.username}`} className="card card-hover group p-5">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Public profile</p>
              <p className="mt-2 font-serif text-2xl text-navy">See what employers see →</p>
            </Link>
          )}
          {spouse ? (
            <Link href="/jobs?arrangement=remote" className="card card-hover group p-5">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Portable careers</p>
              <p className="mt-2 font-serif text-2xl text-navy">Remote jobs that move with you →</p>
            </Link>
          ) : (
            <Link href="/transition" className="card card-hover group p-5">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Transitioning?</p>
              <p className="mt-2 font-serif text-2xl text-navy">Transition Hub & SkillBridge →</p>
              <p className="mt-1 text-xs text-muted">Separating within a year? 90 days of Pro, free</p>
            </Link>
          )}
          {!spouse && vet?.verification_status === 'verified' && (
            <Link href="/dashboard/spouse" className="card card-hover group p-5">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Military family</p>
              <p className="mt-2 font-serif text-2xl text-navy">Invite your spouse →</p>
              <p className="mt-1 text-xs text-muted">They’re verified through you, free</p>
            </Link>
          )}
          <Link href="/settings/account" className="card card-hover group p-5">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Account</p>
            <p className="mt-2 font-serif text-2xl text-navy">Settings & privacy →</p>
          </Link>
          <Link href="/plans" className="card card-hover group p-5">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Plans</p>
            <p className="mt-2 font-serif text-2xl text-navy">Free · Pro · Federal Pro →</p>
          </Link>
        </div>

        <section aria-labelledby="tools-heading">
          <h2 id="tools-heading" className="eyebrow">Your tools</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TOOLS.map((t) => (
              <Link key={t.href} href={t.href} className="card card-hover p-4">
                <p className="font-medium text-navy">{t.label} →</p>
                <p className="mt-1 text-xs text-muted">{t.hint}</p>
              </Link>
            ))}
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Applications" value={applications.length} hint="Most recent five shown below" />
          <StatCard label="Saved jobs" value={savedCount ?? 0} />
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="eyebrow">Recent applications</h2>
            <div className="mt-4">
              {applications.length === 0 ? (
                <EmptyState title="No applications yet." body="Your next opportunity could be here." action={{ href: '/jobs', label: 'Browse jobs' }} />
              ) : (
                <ul className="card divide-y divide-line">
                  {applications.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-4 p-4">
                      <div>
                        {a.job ? (
                          <Link href={`/jobs/${a.job.slug}`} className="font-medium text-navy hover:underline">{a.job.title}</Link>
                        ) : (
                          <span className="text-muted">Position no longer listed</span>
                        )}
                        <p className="text-xs text-muted">{postedAgo(a.applied_at).replace('Posted', 'Applied')}</p>
                      </div>
                      <span className="pill capitalize">{a.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section>
            <h2 className="eyebrow">Newest opportunities</h2>
            <div className="mt-4 space-y-3">
              {latestJobs.length === 0 ? (
                <EmptyState title="No open roles yet." body="New positions will appear here as employers post them." />
              ) : (
                latestJobs.map((job) => <JobCard key={job.id} job={job} />)
              )}
            </div>
          </section>
        </div>

        <section className="card flex flex-col items-start gap-4 border-brass/40 p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Career resources</p>
            <p className="mt-2 font-serif text-2xl">See what your MOS translates to in the civilian world.</p>
          </div>
          <Link href="/resources" className="btn btn-primary shrink-0">Translate my MOS →</Link>
        </section>
      </div>
    </>
  );
}
