import type { Metadata } from 'next';
import Link from 'next/link';
import { BRANCH_SLUGS, publicDb, slugFromBranch } from '@/lib/careers';

export const revalidate = 86400;
export const metadata: Metadata = { title: 'Military to civilian careers: every MOS, rating, and AFSC', description: 'Civilian career translations for 1,469 Army, Marine Corps, Navy, Air Force, Space Force, and Coast Guard jobs.' };

export default async function CareersIndex({ searchParams }: { searchParams: { branch?: string } }) {
  const branch = BRANCH_SLUGS.find(([s]) => s === searchParams.branch)?.[1] ?? 'Army';
  const { data } = await publicDb().from('military_occupations').select('code, title, branch').eq('branch', branch).order('code').limit(1000);
  return (
    <>
      <section className="bg-navy-deep text-ivory"><div className="container-page py-14">
        <p className="eyebrow text-brass">Military career translator</p>
        <h1 className="mt-2 font-serif text-4xl font-medium text-ivory sm:text-5xl">Every military job, translated.</h1>
        <p className="mt-3 max-w-2xl text-cream/80">Civilian careers and skills for 1,469 jobs across all six branches.</p>
        <div className="mt-6 flex flex-wrap gap-2">{BRANCH_SLUGS.map(([s, b]) => <Link key={s} href={`/careers?branch=${s}`} className={`rounded-full border px-4 py-1.5 text-sm ${b === branch ? 'border-brass bg-brass text-navy' : 'border-cream/30 text-cream hover:border-brass'}`}>{b}</Link>)}</div>
      </div></section>
      <div className="container-page py-10">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((o) => (
            <li key={o.code as string}><Link href={`/careers/${slugFromBranch(o.branch as string)}/${(o.code as string).toLowerCase()}`} className="block rounded-[4px] border border-line bg-ivory px-4 py-3 hover:border-brass">
              <span className="font-mono text-xs text-brass-dark">{o.code as string}</span> <span className="text-navy">{o.title as string}</span></Link></li>
          ))}
        </ul>
      </div>
    </>
  );
}
