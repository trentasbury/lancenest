import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { CANONICAL_ORIGIN } from '@/lib/seo';
import { stateOf } from '@/lib/place';
import type { ClearanceLevel, EmploymentType, WorkArrangement } from '@/lib/types';
import { employerNames, scrubText } from '@/lib/scrub';

/**
 * Public job pages (/open-jobs). Anyone, including Google, can read a job's details, but never who is hiring:
 * the company's name, logo, website and page stay hidden, contact details are stripped from the text, and
 * applying needs a verified LanceNest account. Google's job rules allow this ("confidential" employer) and
 * require the full description to be readable without logging in, so the text itself is not cut.
 *
 * A job is public only when: it is open, the employer left "public listing" on, and the company is verified
 * and has a real owner account (seeded sample companies have none, so they never reach Google).
 */

export type PublicJob = {
  slug: string;
  title: string;
  location: string | null;
  work_arrangement: WorkArrangement;
  employment_type: EmploymentType;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: 'year' | 'hour';
  description: string;
  responsibilities: string | null;
  qualifications: string | null;
  preferred_qualifications: string | null;
  benefits: string | null;
  veteran_preferred: boolean;
  clearance_required: ClearanceLevel;
  clearance_eligible: boolean;
  polygraph_required: string | null;
  posted_at: string;
  updated_at: string;
};

const COLUMNS = 'slug, title, location, work_arrangement, employment_type, salary_min, salary_max, salary_period, description, responsibilities, qualifications, preferred_qualifications, benefits, veteran_preferred, clearance_required, clearance_eligible, polygraph_required, posted_at, updated_at';
const TEXT_FIELDS = ['title', 'description', 'responsibilities', 'qualifications', 'preferred_qualifications', 'benefits', 'location'] as const;

type Row = PublicJob & { company: { name: string | null; website: string | null; is_verified: boolean; owner_id: string | null } | null };

function toPublic(r: Row): PublicJob {
  const names = employerNames(r.company?.name ?? null, r.company?.website ?? null);
  const out = { ...r } as PublicJob & { company?: unknown };
  delete out.company;
  for (const f of TEXT_FIELDS) {
    const v = out[f];
    if (typeof v === 'string') (out as Record<string, unknown>)[f] = scrubText(v, names);
  }
  return out;
}

function publicQuery() {
  return createAdminClient().from('jobs')
    .select(`${COLUMNS}, company:companies!inner(name, website, is_verified, owner_id)`)
    .eq('status', 'open').eq('public_listing', true)
    .eq('company.is_verified', true).not('company.owner_id', 'is', null);
}

export const getPublicJob = cache(async (slug: string): Promise<PublicJob | null> => {
  if (!/^[a-z0-9-]{1,160}$/.test(slug)) return null;
  const { data, error } = await publicQuery().eq('slug', slug).maybeSingle();
  if (error) console.error('getPublicJob failed:', error.message);
  return data ? toPublic(data as unknown as Row) : null;
});

export async function listPublicJobs(page = 1, perPage = 30): Promise<{ jobs: PublicJob[]; total: number }> {
  const from = (Math.max(1, page) - 1) * perPage;
  const q = createAdminClient().from('jobs')
    .select(`${COLUMNS}, company:companies!inner(name, website, is_verified, owner_id)`, { count: 'exact' })
    .eq('status', 'open').eq('public_listing', true)
    .eq('company.is_verified', true).not('company.owner_id', 'is', null)
    .order('posted_at', { ascending: false }).range(from, from + perPage - 1);
  const { data, count, error } = await q;
  if (error) console.error('listPublicJobs failed:', error.message);
  return { jobs: ((data ?? []) as unknown as Row[]).map(toPublic), total: count ?? 0 };
}

/** Every public job's address and last change, for the sitemap. */
export async function publicJobSitemap(): Promise<{ slug: string; updated_at: string }[]> {
  const out: { slug: string; updated_at: string }[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data } = await publicQuery().order('posted_at', { ascending: false }).range(from, from + 999);
    const rows = (data ?? []) as unknown as Row[];
    out.push(...rows.map((r) => ({ slug: r.slug, updated_at: r.updated_at })));
    if (rows.length < 1000) break;
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lines = (s: string | null) => (s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

/** The full description as simple HTML, the way Google's job listings expect it. */
export function descriptionHtml(job: PublicJob) {
  const parts = [`<p>${esc(job.description)}</p>`];
  const section = (title: string, text: string | null) => {
    const l = lines(text);
    if (!l.length) return;
    parts.push(`<h3>${title}</h3>`, l.length > 1 ? `<ul>${l.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p>${esc(l[0])}</p>`);
  };
  section('Responsibilities', job.responsibilities);
  section('Qualifications', job.qualifications);
  section('Preferred qualifications', job.preferred_qualifications);
  section('Benefits', job.benefits);
  if (job.clearance_required !== 'none') parts.push(`<p>Security clearance required.</p>`);
  return parts.join('');
}

const TYPE: Record<EmploymentType, string> = { full_time: 'FULL_TIME', part_time: 'PART_TIME', contract: 'CONTRACTOR', internship: 'INTERN', skillbridge: 'INTERN' };

/** Splits "Norfolk, VA" into a city and state. Anything else is left as a region. */
function address(location: string | null) {
  const first = (location ?? '').split(/;|\bor\b/)[0].trim();
  const m = first.match(/^([^,]+),\s*([A-Za-z .]+)$/);
  const st = m ? stateOf(m[2].trim()) : stateOf(first);
  const a: Record<string, string> = { '@type': 'PostalAddress', addressCountry: 'US' };
  if (m) a.addressLocality = m[1].trim();
  if (st) a.addressRegion = st[0];
  else if (!m && first && !/remote|anywhere|multiple|various/i.test(first)) a.addressLocality = first.slice(0, 80);
  return a;
}

/** schema.org JobPosting for Google's job listings. The hiring company is "confidential" by design. */
export function jobPostingJsonLd(job: PublicJob) {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: descriptionHtml(job),
    datePosted: job.posted_at,
    employmentType: TYPE[job.employment_type] ?? 'FULL_TIME',
    hiringOrganization: { '@type': 'Organization', name: 'confidential' },
    directApply: false,
    url: `${CANONICAL_ORIGIN}/open-jobs/${job.slug}`,
  };
  if (job.work_arrangement === 'remote') {
    ld.jobLocationType = 'TELECOMMUTE';
    ld.applicantLocationRequirements = { '@type': 'Country', name: 'USA' };
  } else {
    ld.jobLocation = { '@type': 'Place', address: address(job.location) };
  }
  if (job.salary_min != null || job.salary_max != null) {
    const value: Record<string, unknown> = { '@type': 'QuantitativeValue', unitText: job.salary_period === 'hour' ? 'HOUR' : 'YEAR' };
    if (job.salary_min != null && job.salary_max != null) { value.minValue = job.salary_min; value.maxValue = job.salary_max; }
    else value.value = job.salary_min ?? job.salary_max;
    ld.baseSalary = { '@type': 'MonetaryAmount', currency: 'USD', value };
  }
  return ld;
}

/** JSON for a <script type="application/ld+json"> tag; "<" is escaped so job text can't close the tag. */
export function ldJson(data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
