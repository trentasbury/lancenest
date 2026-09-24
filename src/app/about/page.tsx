import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import StarRule from '@/components/StarRule';

export const metadata: Metadata = { title: 'About', description: 'LanceNest is a veteran-founded career platform for those who served.' };

export default function AboutPage() {
  return (
    <>
      <section className="grid bg-navy-deep text-ivory lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-16">
          <p className="eyebrow text-brass">About LanceNest</p>
          <h1 className="mt-4 font-serif text-5xl font-medium leading-tight text-ivory">Built by veterans, for the ones who come next.</h1>
          <StarRule className="mt-6" />
          <p className="mt-6 max-w-lg text-cream/80">
            Leaving the service shouldn’t mean starting over. LanceNest exists to make military experience legible to the
            civilian world — and to connect those who served with employers who genuinely want them.
          </p>
        </div>
        <div className="flex items-center justify-center px-6 py-14">
          <div className="relative h-[508px] w-[307px] max-w-full">
            <div className="absolute -inset-3 border border-brass/40" aria-hidden="true" />
            <Image src="/assets/lighthouse.webp" alt="A white lighthouse on a harbor at sunset" width={307} height={508} className="relative h-full w-full object-cover" />
          </div>
        </div>
      </section>

      <div className="container-page grid gap-8 py-16 md:grid-cols-3">
        {[
          ['Active duty', 'Plan early. Explore SkillBridge opportunities for your final months of service.'],
          ['Transitioning', 'Translate your MOS, build your profile, and meet employers before you separate.'],
          ['Veterans', 'Whether it’s been one year or twenty, your next chapter is here.'],
        ].map(([title, body]) => (
          <div key={title} className="card p-7">
            <h2 className="font-serif text-2xl font-semibold">{title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
          </div>
        ))}
      </div>

      <section className="bg-cream py-16 text-center">
        <h2 className="font-serif text-4xl font-medium">Free for every service member. Always.</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/signup?role=veteran" className="btn btn-primary">Build your profile</Link>
          <Link href="/employers" className="btn btn-outline">For employers</Link>
        </div>
      </section>
    </>
  );
}
