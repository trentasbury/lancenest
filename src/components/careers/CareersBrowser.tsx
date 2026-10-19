import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { BRANCH_SLUGS, publicDb, slugFromBranch } from '@/lib/careers';

type OccRow = { code: string; title: string; branch: string };

// Reference data: each branch's list is cached for a day.
const occupationsFor = unstable_cache(async (branch: string): Promise<OccRow[]> => {
  const res = await publicDb().from('military_occupations').select('code, title, branch').eq('branch', branch).order('code').limit(1000);
  return (res.data ?? []) as OccRow[];
}, ['careers-branch-list'], { revalidate: 86400 });

/** The career translator index for one branch (shared by /careers and /careers/[branch]). */
export default async function CareersBrowser({ branch }: { branch: string }) {
  const data = await occupationsFor(branch);
  return (
    <>
      <section className="bg-navy-deep text-ivory"><div className="container-page py-14">
        <p className="eyebrow text-brass">Military career translator</p>
        <h1 className="mt-2 font-serif text-4xl font-medium text-ivory sm:text-5xl">Every military job, translated.</h1>
        <p className="mt-3 max-w-2xl text-cream/80">Civilian careers and skills for 1,469 jobs across all six branches.</p>
        <div className="mt-6 flex flex-wrap gap-2">{BRANCH_SLUGS.map(([s, b]) => <Link key={s} href={s === 'army' ? '/careers' : `/careers/${s}`} aria-current={b === branch ? 'page' : undefined} className={`rounded-full border px-4 py-1.5 text-sm ${b === branch ? 'border-brass bg-brass text-navy' : 'border-cream/30 text-cream hover:border-brass'}`}>{b}</Link>)}</div>
      </div></section>
      <div className="container-page py-10">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((o) => (
            <li key={o.code}><Link href={`/careers/${slugFromBranch(o.branch)}/${o.code.toLowerCase()}`} className="block rounded-xl border border-line bg-ivory px-4 py-3 hover:border-brass">
              <span className="font-mono text-xs text-brass-dark">{o.code}</span> <span className="text-navy">{o.title}</span></Link></li>
          ))}
        </ul>
      </div>
    </>
  );
}
