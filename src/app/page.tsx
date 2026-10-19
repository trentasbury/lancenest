import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { unstable_cache } from 'next/cache';
import QueryNotice from '@/components/QueryNotice';

const FEATURES = [
  { icon: '☆', title: 'Veteran Focused', body: 'Built by a Marine veteran, for everyone who served. Your record is read as an asset, never a gap.' },
  { icon: '◇', title: 'Top Opportunities', body: 'Employers here are looking for military talent on purpose — not by accident.' },
  { icon: '✧', title: 'Career Resources', body: 'Translate your MOS, rating, or AFSC into the civilian roles it prepares you for.' },
  { icon: '❖', title: 'A Stronger Community', body: 'Active duty, National Guard, Reserve, transitioning, and veteran members in one professional network.' },
];

const LOOP = ['Service', 'Skills', 'Translation', 'Opportunity', 'Application', 'Career'];

// Public counts change slowly: computed at most every 10 minutes, then served from cache.
const getStats = unstable_cache(async () => {
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
}, ['home-stats'], { revalidate: 600 });

export const metadata: Metadata = { alternates: { canonical: '/' } };

// Pre-built and served from the location nearest each visitor; refreshed every 10 minutes.
export const revalidate = 600;

export default async function HomePage() {
  const stats = await getStats();
  return (
    <>
      <Suspense fallback={null}>
        <QueryNotice param="deleted" message="Your account and data have been permanently deleted." className="bg-olive/10 py-3 text-center text-sm text-olive" />
      </Suspense>
      {/* Hero: what LanceNest is, a job search, and a glimpse of the product (like Contra and LinkedIn). */}
      <section className="relative overflow-hidden bg-navy-deep text-ivory">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-brass/10 blur-3xl" aria-hidden="true" />
        <div className="container-page relative grid items-center gap-14 py-16 lg:grid-cols-[1.15fr_1fr] lg:py-24">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-brass/40 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-brass-light">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-olive text-[10px] text-ivory" aria-hidden="true">✓</span>
              Every member verified by a person
            </p>
            <h1 className="mt-6 font-serif text-[clamp(2.4rem,7vw,4.6rem)] font-medium leading-[1.02] text-ivory">
              The professional network for people who served.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-cream/80">
              Jobs, freelance work, mentors, and a network of verified service members and veterans, plus the employers who want to hire them.
            </p>

            <form action="/jobs" method="get" className="mt-9 flex w-full max-w-2xl flex-col gap-2 rounded-2xl bg-ivory p-2 shadow-lift sm:flex-row sm:rounded-full">
              <label htmlFor="hero-q" className="sr-only">Job title, keyword, or company</label>
              <input id="hero-q" name="q" placeholder="Job title, keyword, or company" className="flex-1 rounded-full px-5 py-3 text-[15px] text-ink outline-none placeholder:text-muted" />
              <label htmlFor="hero-location" className="sr-only">Location</label>
              <input id="hero-location" name="location" placeholder="Location" className="rounded-full px-5 py-3 text-[15px] text-ink outline-none placeholder:text-muted sm:w-44 sm:border-l sm:border-line sm:rounded-none" />
              <button type="submit" className="btn btn-primary sm:px-7">Find Jobs →</button>
            </form>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup?role=veteran" className="btn btn-brass" data-track="cta_home_member_signup">I served — join free</Link>
              <Link href="/signup?role=employer" className="btn border border-cream/30 text-ivory hover:bg-white/10" data-track="cta_home_employer_signup">I’m hiring veterans</Link>
            </div>
            <p className="mt-6 text-sm text-cream/60">Free for service members · 1,469 military jobs translated · Built by a Marine veteran</p>
          </div>

          {/* Product glimpse: the photo with two illustrative cards floating over it. Decorative. */}
          <div className="relative mx-auto hidden w-full max-w-[460px] lg:block" aria-hidden="true">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] shadow-lift ring-1 ring-white/10">
              <Image src="/assets/hero-service.webp" alt="" fill priority quality={90} sizes="(min-width: 1024px) 460px, 0px" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/70 via-transparent to-transparent" />
              <p className="absolute bottom-4 left-5 text-xs text-cream/80">Our founder, U.S. Marine Corps veteran</p>
            </div>
            <div className="absolute -left-14 top-10 w-72 rounded-2xl border border-line/70 bg-ivory p-4 text-ink shadow-lift">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy font-serif text-sm text-brass">JD</span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-sm font-semibold">Verified member <span className="flex h-4 w-4 items-center justify-center rounded-full bg-olive text-[9px] text-ivory">✓</span></p>
                  <p className="truncate text-xs text-muted">USMC 0311 → Operations Coordinator</p>
                </div>
              </div>
            </div>
            <div className="absolute -right-8 bottom-16 w-72 rounded-2xl border border-line/70 bg-ivory p-4 text-ink shadow-lift">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Logistics Program Manager</p>
                  <p className="mt-0.5 text-xs text-muted">Defense contractor · Hybrid</p>
                </div>
                <span className="shrink-0 whitespace-nowrap rounded-full bg-olive/10 px-2 py-0.5 text-[10px] font-semibold text-olive">Easy Apply</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="pill">Secret clearance</span>
                <span className="pill">Veteran preferred</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature bar */}
      <section className="bg-navy text-ivory">
        <div className="container-page grid grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`px-3 py-8 text-center sm:px-6 sm:py-10 ${i < FEATURES.length - 1 ? 'lg:border-r lg:border-white/10' : ''}`}
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
          <div className="min-w-0">
            <p className="eyebrow">See it before you sign up</p>
            <h2 className="mt-2 font-serif text-3xl font-medium text-navy">Your military job, in civilian terms.</h2>
            <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-ivory">
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
          <div className="min-w-0">
            <p className="eyebrow">For employers</p>
            <h2 className="mt-2 font-serif text-3xl font-medium text-navy">Verified military talent for federal-ready professional work.</h2>
            <p className="mt-3 text-muted"><strong className="text-ink">Search verified talent. Post jobs. Message candidates. Manage applicants.</strong> Built for government contractors, defense subcontractors, and veteran-owned firms hiring for:</p>
            <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              {['Program & project management', 'Proposal & capture support', 'Logistics & supply chain', 'IT support & cyber operations', 'Operations & analysis', 'Training & instructional design', 'Business development', 'Executive & administrative operations'].map((r) => <li key={r} className="rounded-xl border border-line bg-ivory px-3 py-2">{r}</li>)}
            </ul>
            <div className="mt-5 flex flex-wrap gap-3"><Link href="/signup?role=employer" className="btn btn-primary" data-track="cta_home_hire">Start free</Link><Link href="/employers" className="btn btn-ghost border border-line" data-track="cta_home_plans">See employer plans</Link><Link href="/contact-sales" className="btn btn-outline" data-track="cta_home_book_call">Book a call</Link></div>
            <p className="mt-3 text-xs text-muted">No placement fees on hires you make through job posts. Clearances shown on profiles are self-reported.</p>
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
            <div className="card p-5"><p className="font-semibold text-navy">Every member</p><p className="mt-1 text-sm text-muted">A person checks proof of service — DD-214, LES, orders, NGB-22, or a VA letter — against a photo ID. Both files are deleted as soon as the reviewer approves or rejects them. Military ID cards are never accepted.</p></div>
            <div className="card p-5"><p className="font-semibold text-navy">Every employer</p><p className="mt-1 text-sm text-muted">Company domain or business documents are verified before anyone can post a job, search, or message members.</p></div>
            <div className="card p-5"><p className="font-semibold text-navy">What’s self-reported</p><p className="mt-1 text-sm text-muted">Security clearances are self-reported and labeled that way. Employers confirm eligibility through official channels.</p></div>
          </div>
          {stats && (
            <p className="mt-6 text-sm text-muted">{stats.members >= 100 ? `${stats.members.toLocaleString()} verified members · ${stats.jobs.toLocaleString()} open roles · ${stats.companies.toLocaleString()} verified employers` : 'Founding period: LanceNest opened in 2026. Founding Employers get launch pricing plus direct onboarding with our founder; early members get seen first.'}</p>
          )}
        </div>
      </section>

      {/* Closing call to action */}
      <section className="bg-navy-deep py-20 text-ivory">
        <div className="container-page flex flex-col items-center text-center">
          <p className="text-xs tracking-[0.3em] text-brass-light">VETERANS TODAY · LEADERS TOMORROW</p>
          <h2 className="mt-4 max-w-2xl font-serif text-4xl font-medium text-ivory sm:text-5xl">Your service is the résumé. Let’s put it to work.</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup?role=veteran" className="btn btn-brass px-7" data-track="cta_home_footer_member">Create your free profile</Link>
            <Link href="/employers" className="btn border border-cream/30 px-7 text-ivory hover:bg-white/10" data-track="cta_home_footer_employer">Hire verified veterans</Link>
          </div>
        </div>
      </section>
    </>
  );
}
