import type { Metadata } from 'next';
import Link from 'next/link';
import { CATEGORIES } from '@/lib/freelance';
import { categorySlug } from '@/lib/publicServices';
import { FREELANCE_PAYMENTS_ENABLED, LICENSED_TRADES } from '@/lib/flags';
import { FREELANCE_FEES } from '@/lib/fees';
import { CANONICAL_ORIGIN } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Freelance anything: from mechanic work to web design',
  description: 'Verified service members, veterans and military spouses can sell any skill on LanceNest: diesel repair, HVAC, roofing, fitness coaching, web design and everything in between.',
  alternates: { canonical: `${CANONICAL_ORIGIN}/freelance-anything` },
};

// How the categories are grouped on this page. Anything not listed here still shows, under "Everything else".
const GROUPS: [string, string, string[]][] = [
  ['Hands-on and on-site', 'Jobs you do in person, at a home, a shop or a job site.', ['Automotive & diesel', 'HVAC & refrigeration', 'Electrical', 'Plumbing',
    'Construction & remodeling', 'Roofing & exteriors', 'Welding & fabrication', 'Handyman & home repair', 'Landscaping & outdoor', 'Moving & hauling', 'Cleaning & property services']],
  ['Coaching, people and events', 'Work built on leading, teaching and looking after people.', ['Fitness & coaching', 'Training & instruction', 'Events & hospitality',
    'Photography & video', 'Security & protection services', 'Healthcare & medical', 'HR & recruiting']],
  ['Remote and professional', 'Work you can do from anywhere, for clients anywhere.', ['Web design & development', 'Software development', 'Cybersecurity', 'IT support & networking',
    'Enterprise software (ITSM, ERP, CRM)', 'Data & analytics', 'Intelligence & analysis', 'Graphic design & branding', 'Marketing & social media', 'Writing & editing',
    'Proposals & grant writing', 'Program & project management', 'Logistics & supply chain', 'Consulting & strategy', 'Accounting & bookkeeping', 'Legal & paralegal', 'Aviation & drones']],
];
const grouped = new Set(GROUPS.flatMap(([, , list]) => list));
const rest = CATEGORIES.filter((c) => !grouped.has(c) && c !== 'Other');

const EXAMPLES = ['Diesel mechanic', 'Personal trainer', 'HVAC tech', 'Roofer', 'Web designer', 'Grant writer', 'Photographer', 'Cyber analyst'];

export default function FreelanceAnythingPage() {
  const freeFee = Math.round(FREELANCE_FEES.veteranRate.free * 100);
  const bestFee = Math.round(FREELANCE_FEES.veteranRate.federal_pro * 100);
  const steps: [string, string][] = [
    ['Get verified', 'A person checks your service once. It’s why clients come here to hire, and why you don’t compete with the whole internet.'],
    ['Answer projects, or offer a service', 'Anyone can post a job here; only verified members can answer. Send proposals (5 a month free, unlimited on paid plans), or list a service clients can book.'],
    ['Get booked', FREELANCE_PAYMENTS_ENABLED
      ? `The client funds the work before you start. You keep ${100 - freeFee}% on the Free plan, up to ${100 - bestFee}% on paid plans.`
      : 'No lead fees, ever. A small booking fee is paid only when you’re booked (by the client, or by you if you choose to cover it so clients see “No booking fee”). You keep 100% of what the client pays you.'],
  ];

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page py-16">
          <p className="eyebrow text-brass">LanceNest Freelance</p>
          <h1 className="mt-3 max-w-3xl font-serif text-5xl font-medium leading-tight text-ivory">Freelance anything. From mechanic work to web design.</h1>
          <p className="mt-4 max-w-2xl text-cream/80">
            If you served, or you’re married to someone who did, you can sell your skills here: on-site or remote, one-time jobs or ongoing work.
            Clients come to LanceNest because every freelancer is verified.
          </p>
          <ul className="mt-6 flex max-w-3xl flex-wrap gap-2" aria-label="Examples">
            {EXAMPLES.map((e) => <li key={e} className="rounded-full border border-brass/50 px-3 py-1 text-sm text-cream/90">{e}</li>)}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/freelance" className="btn btn-brass">Find freelance work</Link>
            <Link href="/freelance/services/mine" className="btn border border-cream/30 text-ivory hover:bg-white/10">Offer a service</Link>
            <Link href="/signup?role=veteran" className="btn border border-cream/30 text-ivory hover:bg-white/10">Join free and get verified</Link>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-cream">
        <ol className="container-page grid gap-4 py-10 md:grid-cols-3">
          {steps.map(([h, b], i) => (
            <li key={h} className="card p-5"><p className="font-semibold text-navy">{i + 1}. {h}</p><p className="mt-1 text-sm text-muted">{b}</p></li>
          ))}
        </ol>
      </section>

      <div className="container-page space-y-12 py-12">
        {GROUPS.map(([title, blurb, list]) => (
          <section key={title}>
            <h2 className="font-serif text-3xl font-medium text-navy">{title}</h2>
            <p className="mt-1 text-sm text-muted">{blurb}</p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.filter((c) => CATEGORIES.includes(c)).map((c) => (
                <li key={c}>
                  <Link href={`/hire/${categorySlug(c)}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ivory px-4 py-3 text-sm hover:border-brass">
                    <span className="text-ink">{c}</span>
                    {LICENSED_TRADES.includes(c) && <span className="shrink-0 rounded-full bg-brass/15 px-2 py-0.5 text-[11px] font-semibold text-brass-dark">License required</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section>
          <h2 className="font-serif text-3xl font-medium text-navy">Everything else</h2>
          <p className="mt-1 text-sm text-muted">Don’t see your skill? List it under “Other” and describe what you do. If clients book it, it belongs here.</p>
          {rest.length > 0 && (
            <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((c) => <li key={c}><Link href={`/hire/${categorySlug(c)}`} className="block rounded-xl border border-line bg-ivory px-4 py-3 text-sm text-ink hover:border-brass">{c}</Link></li>)}
            </ul>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="card p-6">
            <p className="eyebrow">Licensed trades</p>
            <p className="mt-2 text-sm text-ink/85">HVAC, electrical, plumbing, construction and roofing need a state license. Add yours under Licenses &amp; certificates, and a person checks it before your service goes live. Clients see the verified license on your listing.</p>
          </div>
          <div className="card p-6">
            <p className="eyebrow">Who can hire you</p>
            <p className="mt-2 text-sm text-ink/85">Anyone. Homeowners, small businesses and companies post jobs free (no account needed to start) or book your service. Only verified members can answer.</p>
          </div>
        </section>

        <section className="rounded-2xl bg-navy p-8 text-center text-ivory">
          <h2 className="font-serif text-3xl font-medium">Built by veterans, for veterans.</h2>
          <p className="mx-auto mt-2 max-w-xl text-cream/80">Whatever you learned in uniform or after it, there’s someone who needs it done.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/freelance" className="btn btn-brass">Find freelance work</Link>
            <Link href="/hire/post" className="btn border border-cream/30 text-ivory hover:bg-white/10">Hiring? Post a project</Link>
          </div>
        </section>
      </div>
    </>
  );
}
