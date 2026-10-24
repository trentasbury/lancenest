import type { Metadata } from 'next';
import Link from 'next/link';
import { MIN_COMPANIES, MIN_JOBS, payInsights, type PayGroup } from '@/lib/payInsights';
import { CANONICAL_ORIGIN } from '@/lib/seo';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Pay for veteran and cleared jobs',
  description: 'What employers hiring veterans pay, by type of role and by security clearance, from the pay ranges verified employers post on LanceNest.',
  alternates: { canonical: `${CANONICAL_ORIGIN}/pay` },
};

const k = (n: number) => `$${Math.round(n / 1000)}K`;

function Table({ title, groups, label }: { title: string; groups: PayGroup[]; label: string }) {
  const top = Math.max(...groups.map((g) => g.high), 1);
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl font-semibold">{title}</h2>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-muted">
            <tr><th className="p-3">{label}</th><th className="p-3">Typical range</th><th className="p-3 w-2/5">Range</th><th className="p-3">Jobs</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {groups.map((g) => (
              <tr key={g.name}>
                <td className="p-3 font-medium text-ink">{g.name}</td>
                <td className="p-3 whitespace-nowrap font-semibold text-navy">{k(g.low)} – {k(g.high)}</td>
                <td className="p-3">
                  <div className="relative h-2 rounded-full bg-line/60" aria-hidden="true">
                    <div className="absolute h-2 rounded-full bg-navy" style={{ left: `${(g.low / top) * 100}%`, width: `${Math.max(2, ((g.high - g.low) / top) * 100)}%` }} />
                  </div>
                </td>
                <td className="p-3 text-muted">{g.jobs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function PayPage() {
  const { families, clearance, total } = await payInsights();
  const enough = families.length > 0 || clearance.length > 0;
  return (
    <div className="container-page max-w-4xl py-12">
      <p className="eyebrow">Pay insights</p>
      <h1 className="mt-2 font-serif text-4xl font-medium leading-tight sm:text-5xl">What employers hiring veterans pay</h1>
      <p className="mt-3 max-w-2xl text-muted">
        From the pay ranges verified employers posted on LanceNest in the last 12 months. Each row is the typical posted range: the middle of the lows to the middle of the highs. Hourly pay is counted as 2,080 hours a year.
      </p>

      {!enough ? (
        <div className="card mt-10 p-8">
          <p className="font-semibold text-ink">Pay insights are growing.</p>
          <p className="mt-2 text-sm text-muted">A group appears once at least {MIN_JOBS} jobs from {MIN_COMPANIES} or more employers have posted pay, so no single employer’s pay can be identified. {total > 0 ? `${total} jobs with posted pay so far.` : ''}</p>
          <div className="mt-5 flex flex-wrap gap-2"><Link href="/open-jobs" className="btn btn-primary">See open jobs</Link><Link href="/careers" className="btn btn-outline">Translate your MOS</Link></div>
        </div>
      ) : (
        <>
          {families.length > 0 && <Table title="By type of role" groups={families} label="Role" />}
          {clearance.length > 0 && <Table title="By security clearance" groups={clearance} label="Clearance required" />}
          <p className="mt-6 text-xs text-muted">Based on {total} jobs with posted pay. Groups with fewer than {MIN_JOBS} jobs or {MIN_COMPANIES} employers are left out. Posted ranges aren’t offers; actual pay depends on experience, location and the employer.</p>
        </>
      )}
      <div className="card mt-10 border-brass/40 p-6">
        <p className="font-semibold text-ink">Know what your experience is worth</p>
        <p className="mt-1 text-sm text-muted">Translate your MOS, rating or AFSC into civilian roles, then see which verified employers are hiring for them.</p>
        <Link href="/careers" className="btn btn-outline mt-4">Translate your MOS</Link>
      </div>
    </div>
  );
}
