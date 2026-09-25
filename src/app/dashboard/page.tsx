import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import VerificationBadge from '@/components/VerificationBadge';
import JobCard from '@/components/JobCard';
import { searchJobs } from '@/lib/jobs';
import { postedAgo } from '@/lib/format';

export const metadata: Metadata = { title: 'Dashboard' };

type AppRow = { id: string; status: string; applied_at: string; job: { title: string; slug: string } | null };

export default async function VeteranDashboard() {
  const { user, profile } = await requireRole(['veteran'], '/dashboard');
  const supabase = createClient();

  const [{ data: vet }, { count: savedCount }, { data: apps }, latestJobs] = await Promise.all([
    supabase.from('veteran_profiles').select('verification_status').eq('profile_id', user.id).maybeSingle(),
    supabase.from('saved_jobs').select('job_id', { count: 'exact', head: true }).eq('profile_id', user.id),
    supabase
      .from('applications')
      .select('id, status, applied_at, job:jobs(title, slug)')
      .eq('profile_id', user.id)
      .order('applied_at', { ascending: false })
      .limit(5),
    searchJobs({}, 3),
  ]);

  const applications = (apps ?? []) as unknown as AppRow[];
  const firstName = profile.full_name.split(' ')[0] || 'there';

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page flex flex-col gap-5 py-12 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow text-brass">Welcome back</p>
            <h1 className="mt-3 font-serif text-5xl font-medium text-ivory">Welcome back, {firstName}.</h1>
            <p className="mt-2 font-serif text-xl italic text-cream/85">Your next mission is waiting.</p>
          </div>
          <VerificationBadge status={vet?.verification_status ?? 'not_verified'} />
        </div>
      </section>

      <div className="container-page space-y-10 py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/dashboard/profile" className="card group p-5 transition-colors hover:border-brass">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Your profile</p>
            <p className="mt-2 font-serif text-2xl text-navy">{profile.onboarding_completed ? 'Edit profile' : 'Build your profile'} →</p>
            <p className="mt-1 text-xs text-muted">Name, about, skills, service, experience</p>
          </Link>
          <Link href="/dashboard/verification" className="card group p-5 transition-colors hover:border-brass">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Verification</p>
            <p className="mt-2 font-serif text-2xl text-navy">{vet?.verification_status === 'verified' ? 'Verified ✦' : 'Get verified'} →</p>
            <p className="mt-1 text-xs text-muted">Earn the Verified Veteran badge</p>
          </Link>
          {profile.username && (
            <Link href={`/veterans/${profile.username}`} className="card group p-5 transition-colors hover:border-brass">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Public profile</p>
              <p className="mt-2 font-serif text-2xl text-navy">See what employers see →</p>
            </Link>
          )}
          <Link href="/plans" className="card group p-5 transition-colors hover:border-brass">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Plans</p>
            <p className="mt-2 font-serif text-2xl text-navy">Free · Pro · Federal Pro →</p>
          </Link>
        </div>

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
