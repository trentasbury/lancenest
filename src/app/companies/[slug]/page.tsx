import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CompanyMark from '@/components/CompanyMark';
import JobCard from '@/components/JobCard';
import EmptyState from '@/components/EmptyState';
import { createClient } from '@/lib/supabase/server';
import type { Company, JobWithCompany } from '@/lib/types';

async function getCompany(slug: string) {
  const supabase = createClient();
  const { data } = await supabase.from('companies').select('*').eq('slug', slug).maybeSingle();
  return (data as Company | null) ?? null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const company = await getCompany(params.slug);
  if (!company) return { title: 'Company not found' };
  return { title: `${company.name} Jobs`, description: company.about?.slice(0, 160) ?? `Open roles at ${company.name}.` };
}

export default async function CompanyPage({ params }: { params: { slug: string } }) {
  const company = await getCompany(params.slug);
  if (!company) notFound();

  const supabase = createClient();
  const { data } = await supabase
    .from('jobs')
    .select('*, company:companies(name, slug, logo_url, is_verified, industry)')
    .eq('company_id', company.id)
    .eq('status', 'open')
    .order('posted_at', { ascending: false });
  const jobs = (data ?? []) as JobWithCompany[];

  return (
    <>
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
                <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm text-brass-light underline underline-offset-4">
                  Visit website
                </a>
              )}
            </div>
          </div>
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
            <p className="eyebrow">Open positions ({jobs.length})</p>
            <div className="mt-4 space-y-4">
              {jobs.length === 0 ? (
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
          <Link href="/jobs" className="btn btn-outline w-full">Browse all jobs</Link>
        </aside>
      </div>
    </>
  );
}
