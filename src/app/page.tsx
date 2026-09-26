import Image from 'next/image';
import Link from 'next/link';
import StarRule from '@/components/StarRule';

const FEATURES = [
  { icon: '☆', title: 'Veteran Focused', body: 'Built by veterans, for veterans. Your record is read as an asset, never a gap.' },
  { icon: '◇', title: 'Top Opportunities', body: 'Employers here are looking for military talent on purpose — not by accident.' },
  { icon: '✧', title: 'Career Resources', body: 'Translate your MOS, rating, or AFSC into the civilian roles it prepares you for.' },
  { icon: '❖', title: 'A Stronger Community', body: 'Active duty, transitioning, and veteran members in one professional network.' },
];

const LOOP = ['Service', 'Skills', 'Translation', 'Opportunity', 'Application', 'Career'];

export default function HomePage({ searchParams }: { searchParams: { deleted?: string } }) {
  return (
    <>
      {searchParams.deleted && (
        <div className="bg-olive/10 py-3 text-center text-sm text-olive">Your account and data have been permanently deleted.</div>
      )}
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-deep text-ivory">
        <div className="container-page grid items-center gap-12 py-16 lg:grid-cols-[1.25fr_1fr] lg:py-24">
          <div>
            <p className="eyebrow text-brass">Veteran Jobs · Built for What’s Next</p>
            <h1 className="mt-5 font-serif text-6xl font-medium tracking-[0.06em] text-ivory sm:text-7xl lg:text-8xl">LANCENEST</h1>
            <StarRule className="mt-6" />
            <p className="mt-6 max-w-xl font-serif text-2xl italic leading-snug text-cream">
              Same mission. New battlefield.
              <br />
              Your next chapter starts here.
            </p>

            <form action="/jobs" method="get" className="mt-10 flex max-w-2xl flex-col gap-2 rounded-[6px] bg-ivory p-2 shadow-lift sm:flex-row">
              <label htmlFor="hero-q" className="sr-only">Job title, keyword, or company</label>
              <input id="hero-q" name="q" placeholder="Job title, keyword, or company" className="flex-1 rounded-[3px] px-4 py-3 text-[15px] text-ink outline-none placeholder:text-muted" />
              <label htmlFor="hero-location" className="sr-only">Location</label>
              <input id="hero-location" name="location" placeholder="Location" className="rounded-[3px] px-4 py-3 text-[15px] text-ink outline-none placeholder:text-muted sm:w-44 sm:border-l sm:border-line" />
              <button type="submit" className="btn btn-primary sm:px-7">Find Jobs →</button>
            </form>

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-cream/80">
              <Link href="/signup?role=veteran" className="underline decoration-brass/60 underline-offset-4 hover:text-brass">I served — build my profile</Link>
              <Link href="/signup?role=employer" className="underline decoration-brass/60 underline-offset-4 hover:text-brass">I’m hiring veterans</Link>
            </div>
          </div>

          <div className="relative hidden aspect-[3/5] max-h-[560px] justify-self-end lg:block">
            <div className="absolute -inset-3 border border-brass/40" aria-hidden="true" />
            <Image
              src="/assets/veteran-silhouette.webp"
              alt="A veteran with a pack looking out over a harbor at sunset"
              fill
              priority
              quality={90}
              sizes="(min-width: 1024px) 340px, 0px"
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
        <div className="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-16 lg:py-24">
          <span className="h-0.5 w-12 bg-brass" aria-hidden="true" />
          <p className="eyebrow mt-5">More Than a Job Board</p>
          <h2 className="mt-4 font-serif text-5xl font-medium leading-[1.05]">
            Your Next Chapter
            <br />
            Starts Here.
          </h2>
          <p className="mt-6 max-w-md text-[17px] leading-relaxed text-muted">
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
      <section className="bg-navy-deep py-20 text-center text-ivory">
        <h2 className="font-serif text-3xl font-medium tracking-[0.12em] text-ivory sm:text-4xl">VETERANS TODAY. LEADERS TOMORROW.</h2>
        <p className="mt-4 text-xs tracking-[0.3em] text-brass-light">SERVICE · LEADERSHIP · OPPORTUNITY</p>
      </section>
    </>
  );
}
