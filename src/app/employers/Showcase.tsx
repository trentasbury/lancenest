import { ExampleMemberCard } from '@/components/ExampleCards';

/**
 * What hiring veterans costs elsewhere, as published or reported. Comparisons must stay accurate: every row is
 * dated and linked to its source, and the note says prices change. Update AS_OF and the rows together.
 */
const AS_OF = 'October 2026';
const ROWS: { option: string; price: string; buys: string; source?: string }[] = [
  { option: 'LanceNest Starter', price: '$99/month', buys: '5 open jobs, 1 seat, every applicant verified' },
  { option: 'LanceNest Professional', price: '$249/month', buys: '10 open jobs, 2 seats, search every verified member' },
  { option: 'LinkedIn Recruiter Lite', price: 'About $170/month', buys: '1 seat, searching all of LinkedIn', source: 'https://salesbread.com/how-much-does-linkedin-premium-cost/' },
  { option: 'Indeed sponsored job', price: 'Per click; often $15–$50 per application', buys: 'Paid placement for one job', source: 'https://www.hiretruffle.com/blog/indeed-pricing' },
  { option: 'Indeed résumé search', price: 'About $120–$300/month', buys: '30–100 candidate contacts a month', source: 'https://www.hiretruffle.com/blog/indeed-pricing' },
  { option: 'RecruitMilitary career fair', price: '$1,495 per event', buys: 'One booth at one event', source: 'https://recruitmilitary.com/employers/career-fairs/' },
];

export function CostComparison() {
  return (
    <section className="bg-ivory">
      <div className="container-page py-14">
        <p className="eyebrow">What it costs elsewhere</p>
        <h2 className="mt-2 max-w-3xl font-serif text-3xl font-medium text-navy">A month of Professional costs about what 5 to 17 sponsored Indeed applicants do.</h2>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line" tabIndex={0} role="region" aria-label="Cost comparison">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line bg-paper text-xs uppercase tracking-[0.12em] text-muted"><tr><th className="p-3">Option</th><th className="p-3">Price</th><th className="p-3">What it buys</th></tr></thead>
            <tbody className="divide-y divide-line">
              {ROWS.map((r) => (
                <tr key={r.option} className={r.option.startsWith('LanceNest') ? 'bg-brass/5' : ''}>
                  <td className="p-3 font-medium text-ink">{r.source ? <a href={r.source} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-line underline-offset-4 hover:decoration-brass">{r.option}</a> : r.option}</td>
                  <td className="p-3 whitespace-nowrap">{r.price}</td>
                  <td className="p-3 text-ink/80">{r.buys}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">Other providers’ prices as published or reported in {AS_OF}, linked to each source. Prices change and vary by account, so check with each provider. LanceNest is not affiliated with any of them.</p>
      </div>
    </section>
  );
}

export function SampleCandidate() {
  return (
    <section className="bg-paper">
      <div className="container-page grid items-center gap-10 py-14 lg:grid-cols-2">
        <div>
          <p className="eyebrow">What you’ll see</p>
          <h2 className="mt-2 font-serif text-3xl font-medium text-navy">Every candidate is a verified service member, explained in civilian terms.</h2>
          <ul className="mt-5 space-y-2 text-sm text-ink/85">
            <li className="flex gap-2"><span className="text-brass">✦</span>Service checked by a person against official records and a photo ID</li>
            <li className="flex gap-2"><span className="text-brass">✦</span>Military job translated into the civilian roles it prepares them for</li>
            <li className="flex gap-2"><span className="text-brass">✦</span>Availability, target pay and work arrangement up front</li>
            <li className="flex gap-2"><span className="text-brass">✦</span>Clearances shown as self-reported; you confirm eligibility in official systems</li>
          </ul>
        </div>
        <div className="mx-auto w-full max-w-md"><ExampleMemberCard /></div>
      </div>
    </section>
  );
}
