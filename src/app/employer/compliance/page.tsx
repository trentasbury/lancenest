import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getMyCompany } from '@/lib/employer';
import StatCard from '@/components/StatCard';
import Upsell from '@/components/employer/Upsell';
import PrintButton from '@/components/PrintButton';

export const metadata: Metadata = { title: 'Veteran outreach report', robots: { index: false } };

type JobRow = { id: string; title: string; status: string; posted_at: string; location: string | null };
type AppRow = { id: string; job_id: string; status: string; source: string; applied_at: string };
type ViewRow = { job_id: string; viewer_id: string; viewed_on: string };
type HistRow = { application_id: string; status: string; changed_at: string };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/**
 * A yearly record of the company's outreach to veterans through LanceNest, for federal contractors' annual review of
 * their veteran outreach (VEVRAA). Federal and Enterprise plans. Counts come from the employer's own jobs only.
 */
export default async function CompliancePage(props: { searchParams: Promise<{ year?: string }> }) {
  const { user } = await requireRole(['employer'], '/employer/compliance');
  const company = await getMyCompany(user.id);
  if (!company) redirect('/employer/dashboard');
  const { year: rawYear } = await props.searchParams;
  const thisYear = new Date().getUTCFullYear();
  const firstYear = Math.min(thisYear, new Date(String(company.created_at ?? new Date().toISOString())).getUTCFullYear());
  const year = Math.min(thisYear, Math.max(firstYear, Number.parseInt(rawYear ?? '', 10) || thisYear));

  if (!['federal', 'enterprise'].includes(company.plan)) {
    return (
      <div className="container-page max-w-3xl py-12">
        <h1 className="mb-6 font-serif text-4xl font-medium">Veteran outreach report</h1>
        <Upsell plan="Federal" title="Document your veteran outreach in one click." body="Federal contractors must review their outreach to protected veterans every year. This report records every job you listed on LanceNest, how many verified service members and veterans saw it, applied, interviewed and got offers, ready to print or save as a PDF." />
      </div>
    );
  }

  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;
  const supabase = await createClient();
  const { data: jobsRaw } = await supabase.from('jobs').select('id, title, status, posted_at, location').eq('company_id', company.id).lt('posted_at', end).order('posted_at', { ascending: true }).limit(5000);
  const jobs = (jobsRaw ?? []) as JobRow[];
  const ids = jobs.map((j) => j.id);
  const page = <T,>(rows: T[] | null) => (rows ?? []) as T[];
  const [views, apps] = ids.length
    ? await Promise.all([
        supabase.from('job_views').select('job_id, viewer_id, viewed_on').in('job_id', ids).gte('viewed_on', start).lt('viewed_on', end).limit(100000).then((r) => page<ViewRow>(r.data)),
        supabase.from('applications').select('id, job_id, status, source, applied_at').in('job_id', ids).gte('applied_at', start).lt('applied_at', end).limit(50000).then((r) => page<AppRow>(r.data)),
      ])
    : [[] as ViewRow[], [] as AppRow[]];
  const appIds = apps.map((a) => a.id);
  const hist = appIds.length
    ? page<HistRow>((await supabase.from('application_status_history').select('application_id, status, changed_at').in('application_id', appIds).limit(100000)).data)
    : [];

  // A job counts for the year if it was posted during the year, or posted earlier and still taking applicants or views.
  const activeIds = new Set([...views.map((v) => v.job_id), ...apps.map((a) => a.job_id)]);
  const listed = jobs.filter((j) => j.posted_at >= start || activeIds.has(j.id) || j.status === 'open');
  const reached = new Set(views.map((v) => v.viewer_id));
  const easy = apps.filter((a) => a.source === 'lancenest');
  const siteClicks = apps.filter((a) => a.source === 'external');
  const everStatus = (status: string) => new Set([...hist.filter((h) => h.status === status).map((h) => h.application_id), ...easy.filter((a) => a.status === status).map((a) => a.id)]);
  const interviewed = everStatus('interview');
  const offers = everStatus('offer');
  for (const id of offers) interviewed.add(id);

  const per = listed.map((j) => {
    const jv = views.filter((v) => v.job_id === j.id);
    const ja = easy.filter((a) => a.job_id === j.id);
    return {
      ...j,
      reached: new Set(jv.map((v) => v.viewer_id)).size,
      applied: ja.length,
      site: siteClicks.filter((a) => a.job_id === j.id).length,
      interviewed: ja.filter((a) => interviewed.has(a.id)).length,
      offers: ja.filter((a) => offers.has(a.id)).length,
    };
  });
  const generated = new Date().toISOString();
  const years = Array.from({ length: thisYear - firstYear + 1 }, (_, i) => thisYear - i);

  return (
    <div className="container-page max-w-5xl py-10">
      <div className="print:hidden">
        <Link href="/employer/analytics" className="text-sm text-muted hover:text-navy">← Hiring analytics</Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <form className="flex items-center gap-2" method="get">
            <label htmlFor="year" className="text-sm text-muted">Year</label>
            <select id="year" name="year" defaultValue={String(year)} className="field w-auto py-2">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button className="btn btn-outline py-2">Show</button>
          </form>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/employer/compliance-export?year=${year}`} className="btn btn-outline">Download records (CSV)</a>
            <PrintButton label="Print or save as PDF" />
          </div>
        </div>
      </div>

      <article className="mt-8">
        <p className="eyebrow">Veteran outreach report · {year}{year === thisYear ? ' (year to date)' : ''}</p>
        <h1 className="mt-2 font-serif text-4xl font-medium">{company.name}</h1>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink/85">
          In {year}{year === thisYear ? ' so far' : ''}, {company.name} listed {listed.length} job{listed.length === 1 ? '' : 's'} on LanceNest (lancenest.com), a career network and job
          board limited to U.S. service members, veterans and military spouses whose military connection LanceNest has reviewed. {reached.size.toLocaleString('en-US')} verified
          member{reached.size === 1 ? '' : 's'} viewed these jobs; {easy.length.toLocaleString('en-US')} applied through LanceNest and {siteClicks.length.toLocaleString('en-US')} more
          went to the company’s own application. {interviewed.size.toLocaleString('en-US')} applicant{interviewed.size === 1 ? ' was' : 's were'} moved to interview and{' '}
          {offers.size.toLocaleString('en-US')} received an offer.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Jobs listed" value={listed.length} />
          <StatCard label="Verified members reached" value={reached.size} />
          <StatCard label="Applied on LanceNest" value={easy.length} />
          <StatCard label="Sent to your site" value={siteClicks.length} />
          <StatCard label="Interviews" value={interviewed.size} />
          <StatCard label="Offers" value={offers.size} />
        </div>

        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-muted">
              <tr><th className="p-3">Job</th><th className="p-3">Posted</th><th className="p-3">Status now</th><th className="p-3">Members reached</th><th className="p-3">Applied</th><th className="p-3">To your site</th><th className="p-3">Interviews</th><th className="p-3">Offers</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {per.length === 0 && <tr><td colSpan={8} className="p-4 text-muted">No jobs were listed in {year}.</td></tr>}
              {per.map((j) => (
                <tr key={j.id}>
                  <td className="p-3"><span className="font-medium text-ink">{j.title}</span>{j.location && <span className="block text-xs text-muted">{j.location}</span>}</td>
                  <td className="p-3">{fmtDate(j.posted_at)}</td>
                  <td className="p-3 capitalize">{j.status}</td>
                  <td className="p-3">{j.reached}</td><td className="p-3">{j.applied}</td><td className="p-3">{j.site}</td><td className="p-3">{j.interviewed}</td><td className="p-3">{j.offers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-8 space-y-2 text-xs leading-relaxed text-muted">
          <p><strong className="text-ink">How these numbers are counted.</strong> “Members reached” counts each verified LanceNest member once, however many times they viewed. Applications and status changes come from LanceNest; offers made outside LanceNest aren’t included. Generated {fmtDate(generated)} from LanceNest records.</p>
          <p><strong className="text-ink">What this report is for.</strong> Federal contractors covered by VEVRAA must review the effectiveness of their outreach to protected veterans each year and keep records of it. This report documents outreach through LanceNest. It doesn’t replace listing jobs with your state employment service, your own self-identification forms (LanceNest verifies military service, not protected-veteran status), or advice from your compliance counsel.</p>
        </section>
      </article>
    </div>
  );
}
