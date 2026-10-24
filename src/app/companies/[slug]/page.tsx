import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import CompanyMark from '@/components/CompanyMark';
import JobCard from '@/components/JobCard';
import EmptyState from '@/components/EmptyState';
import { createClient } from '@/lib/supabase/server';
import type { Company, JobWithCompany } from '@/lib/types';
import { getSessionProfile } from '@/lib/auth';
import SubmitButton from '@/components/SubmitButton';
import { startConversation } from '@/app/messages/actions';
import { safeHref } from '@/lib/safeHref';

// Shared by the page title and the page itself: one lookup per request.
const getCompany = cache(async (slug: string) => {
  const supabase = createClient();
  // Public columns only (verification details, notes and billing IDs are never sent to the browser).
  const { data } = await supabase.from('companies').select('id, slug, name, logo_url, cover_url, industry, headquarters, website, about, mission, benefits, veteran_commitment, is_verified, owner_id').eq('slug', slug).maybeSingle();
  return (data as Company | null) ?? null;
});

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const company = await getCompany(params.slug);
  if (!company) return { title: 'Company not found' };
  return { title: `${company.name} Jobs`, description: company.about?.slice(0, 160) ?? `Open roles at ${company.name}.` };
}

export default async function CompanyPage({ params }: { params: { slug: string } }) {
  const company = await getCompany(params.slug);
  if (!company) notFound();

  const supabase = createClient();
  const [{ data }, session] = await Promise.all([
    supabase
      .from('jobs')
      .select('*, company:companies(name, slug, logo_url, is_verified, industry)')
      .eq('company_id', company.id)
      .eq('status', 'open')
      .order('posted_at', { ascending: false }),
    getSessionProfile(),
  ]);
  const jobs = (data ?? []) as JobWithCompany[];

  return (
    <>
      {(company as unknown as { cover_url?: string | null }).cover_url && <div className="h-48 w-full bg-navy sm:h-64"><img src={(company as unknown as { cover_url: string }).cover_url} alt="" className="h-full w-full object-cover" /></div>}
      <section className="bg-navy-deep text-ivory">
        <div className="container-page flex flex-col gap-6 py-14 sm:flex-row sm:items-center">
          <CompanyMark name={company.name} logoUrl={company.logo_url} size="lg" />
          <div>
            <h1 className="font-serif text-5xl font-medium text-ivory">{company.name}</h1>
            <p className="mt-2 text-cream/80">
              {[company.industry, company.headquarters].filter(Boolean).join(' · ')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {company.is_verified && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brass/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brass">
                  ✦ Veteran-Friendly Employer
                </span>
              )}
              {company.website && (
                <a href={safeHref(company.website)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-cream/30 px-3 py-1 text-[12px] font-medium text-cream hover:border-brass hover:text-brass-light">
                  Visit website ↗ <span className="text-cream/60">{company.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '')}</span>
                </a>
              )}
            </div>
          </div>
          {session && company.owner_id === session.user.id && (
            <Link href="/employer/company" className="btn btn-brass sm:ml-auto">Edit company page</Link>
          )}
        </div>
      </section>

      <div className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_340px]">
        <div className="space-y-10">
          {company.about && (
            <section>
              <p className="eyebrow">About</p>
              <p className="mt-3 text-[16px] leading-relaxed text-ink/90">{company.about}</p>
            </section>
          )}
          <section>
            <p className="eyebrow">Open positions{session ? ` (${jobs.length})` : ''}</p>
            <div className="mt-4 space-y-4">
              {!session ? (
                <EmptyState title="Open positions are for members." body="Create a free account to see this company’s jobs and apply." action={{ href: `/login?next=/companies/${company.slug}`, label: 'Log in or sign up' }} />
              ) : jobs.length === 0 ? (
                <EmptyState title="No open positions right now." body="Check back soon — this company posts new roles regularly." action={{ href: '/jobs', label: 'Browse all jobs' }} />
              ) : (
                jobs.map((job) => <JobCard key={job.id} job={job} />)
              )}
            </div>
          </section>
        </div>
        <aside className="space-y-5">
          {company.veteran_commitment && (
            <div className="card border-brass/40 p-6">
              <p className="eyebrow">Veteran commitment</p>
              <p className="mt-3 font-serif text-xl italic leading-snug text-navy">“{company.veteran_commitment}”</p>
            </div>
          )}
          {company.mission && (
            <div className="card p-6">
              <p className="eyebrow">Mission</p>
              <p className="mt-3 text-sm leading-relaxed text-ink/85">{company.mission}</p>
            </div>
          )}
          {company.benefits && (
            <div className="card p-6">
              <p className="eyebrow">Benefits</p>
              <p className="mt-3 text-sm leading-relaxed text-ink/85">{company.benefits}</p>
            </div>
          )}
          {session && company.owner_id && session.user.id !== company.owner_id && (
            <form action={startConversation.bind(null, company.owner_id)}>
              <SubmitButton className="btn btn-primary w-full" pendingText="Opening…">Message {company.name}</SubmitButton>
            </form>
          )}
          <Link href="/jobs" className="btn btn-outline w-full">Browse all jobs</Link>
        </aside>
      </div>
    </>
  );
}
