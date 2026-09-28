import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

type Rec = { job_id: string; score: number; reasons: string[] };
type J = { id: string; slug: string; title: string; location: string | null; company: { name: string } | null };

/** Jobs ranked on the member's whole profile — civilian experience first, military background weighted by recency. */
export default async function RecommendedJobs({ limit = 6, title = 'Recommended for you' }: { limit?: number; title?: string }) {
  const supabase = createClient();
  const { data: recs } = await supabase.rpc('recommended_jobs', { max_results: limit });
  const list = (recs ?? []) as Rec[];
  if (!list.length) {
    return (
      <section className="card p-6">
        <p className="eyebrow">{title}</p>
        <p className="mt-2 text-sm text-muted">Add your work history, skills, and the roles you want on <Link href="/dashboard/profile" className="text-navy underline">your profile</Link> — we’ll match jobs to your whole background, not just your military job code.</p>
      </section>
    );
  }
  const { data: jobs } = await supabase.from('jobs').select('id, slug, title, location, company:companies(name)').in('id', list.map((r) => r.job_id));
  const byId = new Map(((jobs ?? []) as unknown as J[]).map((j) => [j.id, j]));
  return (
    <section className="card p-6">
      <p className="eyebrow">{title}</p>
      <ul className="mt-3 divide-y divide-line">
        {list.map((r) => { const j = byId.get(r.job_id); if (!j) return null; return (
          <li key={r.job_id} className="py-3">
            <Link href={`/jobs/${j.slug}`} className="font-medium text-navy hover:underline">{j.title}</Link>
            <p className="text-xs text-muted">{[j.company?.name, j.location].filter(Boolean).join(' · ')}</p>
            <p className="mt-1 text-xs text-olive">{r.reasons.join(' · ')}</p>
          </li>
        ); })}
      </ul>
      <p className="mt-3 text-xs text-muted">Based on your experience, skills, and target roles. Your military background counts most while you’re serving or recently out.</p>
    </section>
  );
}
