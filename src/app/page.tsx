import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ensureOccupationsLoaded } from '@/lib/occupations';
import StarRule from '@/components/StarRule';

const FEATURES = [
  { icon: '☆', title: 'Veteran Focused', body: 'Built by veterans, for veterans. Your record is read as an asset, never a gap.' },
  { icon: '◇', title: 'Top Opportunities', body: 'Employers here are looking for military talent on purpose — not by accident.' },
  { icon: '✧', title: 'Career Resources', body: 'Translate your MOS, rating, or AFSC into the civilian roles it prepares you for.' },
  { icon: '❖', title: 'A Stronger Community', body: 'Active duty, National Guard, Reserve, transitioning, and veteran members in one professional network.' },
];

const LOOP = ['Service', 'Skills', 'Translation', 'Opportunity', 'Application', 'Career'];

async function getStats() {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const [m, j, c] = await Promise.all([
      admin.from('veteran_profiles').select('profile_id', { count: 'exact', head: true }).eq('verification_status', 'verified'),
      admin.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      admin.from('companies').select('id', { count: 'exact', head: true }).eq('is_verified', true),
    ]);
    return { members: m.count ?? 0, jobs: j.count ?? 0, companies: c.count ?? 0 };
  } catch { return null; }
}

export const metadata: Metadata = { alternates: { canonical: '/' } };

export default async function HomePage({ searchParams }: { searchParams: { deleted?: string } }) {
  const stats = await getStats();
  await ensureOccupationsLoaded();
  return (
    <>
      {searchParams.deleted && (
        <div className="bg-olive/10 py-3 text-center text-sm text-olive">Your account and data have been permanently deleted.</div>
      )}
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-deep text-ivory">
        <div className="container-page grid items-center gap-12 py-16 lg:grid-cols-[1.25fr_1fr] lg:py-24">
          <div className="min-w-0">
            <p className="eyebrow text-brass">Veteran Jobs · Built for What’s Next</p>
            <h1 className="mt-5 font-serif text-[clamp(2.6rem,13vw,6rem)] font-medium leading-none tracking-[0.04em] text-ivory sm:tracking-[0.06em]">LANCENEST</h1>
            <StarRule className="mt-6" />
            <p className="mt-6 max-w-xl font-serif text-2xl italic leading-snug text-cream">
              Same mission. New battlefield.
              <br />
              Your next chapter starts here.
            </p>

            <form action="/jobs" method="get" className="mt-10 flex w-full max-w-2xl flex-col gap-2 rounded-[6px] bg-ivory p-2 shadow-lift sm:flex-row">
              <label htmlFor="hero-q" className="sr-only">Job title, keyword, or company</label>
              <input id="hero-q" name="q" placeholder="Job title, keyword, or company" className="flex-1 rounded-[3px] px-4 py-3 text-[15px] text-ink outline-none placeholder:text-muted" />
              <label htmlFor="hero-location" className="sr-only">Location</label>
              <input id="hero-location" name="location" placeholder="Location" className="rounded-[3px] px-4 py-3 text-[15px] text-ink outline-none placeholder:text-muted sm:w-44 sm:border-l sm:border-line" />
              <button type="submit" className="btn btn-primary sm:px-7">Find Jobs →</button>
            </form>

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-cream/80">
              <Link href="/signup?role=veteran" className="underline decoration-brass/60 underline-offset-4 hover:text-brass" data-track="cta_home_member_signup">I served — build my profile</Link>
              <Link href="/signup?role=employer" className="underline decoration-brass/60 underline-offset-4 hover:text-brass" data-track="cta_home_employer_signup">I’m hiring veterans</Link>
            </div>
          </div>

          <div className="relative hidden aspect-[4/5] w-full max-w-[432px] justify-self-end lg:block">
            <div className="absolute -inset-3 border border-brass/40" aria-hidden="true" />
            <Image
              src="/assets/hero-service.webp"
              alt="A U.S. Marine in desert camouflage kneeling to help a person on the ground"
              fill
              priority
              quality={90}
              sizes="(min-width: 1024px) 432px, 0px"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* Feature bar */}
      <section className="bg-navy text-ivory">
        <div className="container-page grid sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`px-6 py-10 text-center ${i < FEATURES.length - 1 ? 'border-b border-white/10 lg:border-b-0 lg:border-r' : ''}`}
            >
              <div className="text-2xl text-brass" aria-hidden="true">{f.icon}</div>
              <h2 className="mt-3 font-sans text-[13px] font-semibold uppercase tracking-[0.18em] text-ivory">{f.title}</h2>
              <p className="mx-auto mt-3 max-w-[240px] text-sm leading-relaxed text-cream/75">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Split */}
      <section className="grid bg-paper lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-16 sm:px-12 lg:py-28 lg:pl-[max(4rem,calc((100vw-72rem)/2+2rem))] lg:pr-4">
          <span className="h-0.5 w-12 bg-brass" aria-hidden="true" />
          <p className="eyebrow mt-5">More Than a Job Board</p>
          <h2 className="mt-4 font-serif text-5xl font-medium leading-[1.05] lg:text-6xl">
            Your Next Chapter
            <br />
            Starts Here.
          </h2>
          <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-muted lg:text-lg">
            LanceNest connects service members and veterans with meaningful careers across government, defense,
            technology, operations, and the private sector — and shows employers exactly what your service is worth.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/jobs" className="btn btn-primary">Find Jobs →</Link>
            <Link href="/employers" className="btn btn-outline">For Employers</Link>
          </div>
        </div>
        <div className="relative min-h-[320px] lg:min-h-[520px]">
          <Image
            src="/assets/harbor-still-life.webp"
            alt="A navy cap and a book titled Discipline, Leadership, Service on a boat deck at sunset"
            fill
            quality={90}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
          {/* Blend the photo into the parchment background instead of a hard edge */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-paper to-transparent lg:inset-y-0 lg:left-0 lg:right-auto lg:h-auto lg:w-2/5 lg:bg-gradient-to-r" />
        </div>
      </section>

      {/* Product loop */}
      <section className="border-y border-line bg-cream">
        <div className="container-page py-16 text-center">
          <p className="eyebrow">How LanceNest works</p>
          <h2 className="mx-auto mt-4 max-w-2xl font-serif text-4xl font-medium">Your military experience has value. We make it legible.</h2>
          <ol className="mt-10 flex flex-wrap items-center justify-center gap-y-4 font-serif text-lg text-navy">
            {LOOP.map((step, i) => (
              <li key={step} className="flex items-center">
                <span className="rounded-full border border-brass/60 bg-ivory px-5 py-2">{step}</span>
                {i < LOOP.length - 1 && <span className="mx-3 text-brass" aria-hidden="true">→</span>}
              </li>
            ))}
          </ol>
          <Link href="/resources" className="btn btn-outline mt-10">Translate your MOS →</Link>
        </div>
      </section>

      {/* Closing statement */}
      <section className="bg-paper">
        <div className="container-page grid gap-10 py-16 lg:grid-cols-2">
          <div>
            <p className="eyebrow">See it before you sign up</p>
            <h2 className="mt-2 font-serif text-3xl font-medium text-navy">Your military job, in civilian terms.</h2>
            <div className="mt-5 overflow-x-auto rounded-[6px] border border-line bg-ivory">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-muted"><tr><th className="p-3">Military job</th><th className="p-3">Civilian roles</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {[['Army 92Y · Unit Supply Specialist', 'Supply chain coordinator · Inventory control · Procurement assistant', '/careers/army/92y'],
                    ['Army 25B · IT Specialist', 'Help desk lead · Systems administrator · IT project coordinator', '/careers/army/25b'],
                    ['Marine 0311 · Rifleman', 'Operations coordinator · Site supervisor · Security operations', '/careers/marine-corps/0311'],
                    ['Air Force 2A5X1 · Aerospace Maintenance', 'Field service technician · Maintenance planner · Quality assurance', '/careers/air-force/2a5x1']].map(([m, c, href]) => (
                    <tr key={m}><td className="p-3 font-medium"><Link href={href} className="text-navy hover:underline">{m}</Link></td><td className="p-3 text-ink/80">{c}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link href="/careers" className="mt-4 inline-block text-sm text-navy underline decoration-brass underline-offset-4">Find yours — 1,469 military jobs translated →</Link>
          </div>
          <div>
            <p className="eyebrow">For employers</p>
            <h2 className="mt-2 font-serif text-3xl font-medium text-navy">Verified military talent for federal-ready professional work.</h2>
            <p className="mt-3 text-muted"><strong className="text-ink">Search verified talent. Post jobs. Message candidates. Manage applicants.</strong> Built for government contractors, defense subcontractors, and veteran-owned firms hiring for:</p>
            <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              {['Program & project management', 'Proposal & capture support', 'Logistics & supply chain', 'IT support & cyber operations', 'Operations & analysis', 'Training & instructional design', 'Business development', 'Executive & administrative operations'].map((r) => <li key={r} className="rounded-[4px] border border-line bg-ivory px-3 py-2">{r}</li>)}
            </ul>
            <div className="mt-5 flex flex-wrap gap-3"><Link href="/signup?role=employer" className="btn btn-primary" data-track="cta_home_hire">Start free</Link><Link href="/employers" className="btn btn-ghost border border-line" data-track="cta_home_plans">See employer plans</Link><Link href="/contact-sales" className="btn btn-outline" data-track="cta_home_book_call">Book a call</Link></div>
            <p className="mt-3 text-xs text-muted">No placement fees on hires you make yourself. Clearances shown on profiles are self-reported.</p>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-cream">
        <div className="container-page py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="eyebrow">Trust</p><h2 className="mt-2 font-serif text-3xl font-medium text-navy">How verification works</h2></div>
            <Link href="/trust" className="text-sm text-navy underline decoration-brass underline-offset-4">What we verify — and what we don’t →</Link>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <div className="card p-5"><p className="font-semibold text-navy">Every member</p><p className="mt-1 text-sm text-muted">A person reviews proof of service — DD-214, LES, orders, NGB-22, or a VA letter. Documents are deleted after review. Military ID cards are never accepted.</p></div>
            <div className="card p-5"><p className="font-semibold text-navy">Every employer</p><p className="mt-1 text-sm text-muted">Company domain or business documents are verified before anyone can post a job, search, or message members.</p></div>
            <div className="card p-5"><p className="font-semibold text-navy">What’s self-reported</p><p className="mt-1 text-sm text-muted">Security clearances are self-reported and labeled that way. Employers confirm eligibility through official channels.</p></div>
          </div>
          {stats && (
            <p className="mt-6 text-sm text-muted">{stats.members >= 100 ? `${stats.members.toLocaleString()} verified members · ${stats.jobs.toLocaleString()} open roles · ${stats.companies.toLocaleString()} verified employers` : 'Founding period: LanceNest opened in 2026. Founding Employers get launch pricing plus direct onboarding with our founder; early members get seen first.'}</p>
          )}
        </div>
      </section>

      <section className="bg-navy-deep py-20 text-center text-ivory">
        <h2 className="font-serif text-3xl font-medium tracking-[0.12em] text-ivory sm:text-4xl">VETERANS TODAY. LEADERS TOMORROW.</h2>
        <p className="mt-4 text-xs tracking-[0.3em] text-brass-light">SERVICE · LEADERSHIP · OPPORTUNITY</p>
      </section>
      <section className="border-t border-line bg-paper">
        <div className="container-page flex flex-col items-start justify-between gap-6 py-12 md:flex-row md:items-center">
          <div>
            <p className="eyebrow">Support</p>
            <h2 className="mt-2 font-serif text-3xl font-medium text-navy">Trouble signing in?</h2>
            <p className="mt-2 max-w-xl text-muted">Reset your password in a minute, or email our team — a real person answers, usually within one business day.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/forgot-password" className="btn btn-primary">Reset my password</Link>
            <a href="mailto:support@lancenest.com?subject=LanceNest%20sign-in%20help" className="btn btn-outline">Email support@lancenest.com</a>
          </div>
        </div>
      </section>
    </>
  );
}
