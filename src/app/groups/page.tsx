import type { Metadata } from 'next';
import Link from 'next/link';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import SubmitButton from '@/components/SubmitButton';
import { joinGroup } from './actions';

export const metadata: Metadata = { title: 'Groups' };
type G = { id: string; slug: string; name: string; kind: string; description: string | null };
const KINDS: [string, string][] = [['branch', 'Branches'], ['career', 'Careers'], ['transition', 'Transition classes'], ['state', 'States']];

export default async function GroupsPage() {
  const { user } = await requireVerifiedMember('/groups');
  const supabase = createClient();
  const [{ data: groups }, { data: mine }, { data: counts }, { data: svc }, { data: vet }] = await Promise.all([
    supabase.from('groups').select('id, slug, name, kind, description').order('name'),
    supabase.from('group_members').select('group_id').eq('profile_id', user.id),
    supabase.from('group_members').select('group_id'),
    supabase.from('military_service').select('branch').eq('profile_id', user.id),
    supabase.from('veteran_profiles').select('state, separation_date').eq('profile_id', user.id).maybeSingle(),
  ]);
  const all = (groups ?? []) as G[];
  const joined = new Set((mine ?? []).map((m) => m.group_id as string));
  const size = new Map<string, number>(); (counts ?? []).forEach((c) => size.set(c.group_id as string, (size.get(c.group_id as string) ?? 0) + 1));
  // Suggestions from the profile: branch, state, and separation year.
  const branchSlugs = (svc ?? []).map((s) => (s.branch as string).toLowerCase().replace(/\s+/g, '-'));
  const sepYear = vet?.separation_date ? new Date(vet.separation_date as string).getFullYear() : null;
  const suggested = all.filter((g) => !joined.has(g.id) && (branchSlugs.includes(g.slug) || (vet?.state && g.slug === `state-${(vet.state as string).toLowerCase()}`) || (sepYear && g.slug === `separating-${sepYear}`)));
  const Card = ({ g }: { g: G }) => (
    <li className="card flex items-start justify-between gap-3 p-4">
      <div className="min-w-0"><Link href={`/groups/${g.slug}`} className="font-medium text-navy hover:underline">{g.name}</Link><p className="text-xs text-muted">{size.get(g.id) ?? 0} member{(size.get(g.id) ?? 0) === 1 ? '' : 's'}</p></div>
      {joined.has(g.id) ? <Link href={`/groups/${g.slug}`} className="text-xs text-olive">✓ Joined</Link>
        : <form action={joinGroup.bind(null, g.id, g.slug)}><SubmitButton className="btn btn-outline px-3 py-1.5 text-xs" pendingText="…">Join</SubmitButton></form>}
    </li>
  );
  return (
    <div className="container-page max-w-5xl space-y-8 py-10">
      <div><h1 className="font-serif text-4xl font-medium">Groups</h1><p className="mt-1 text-muted">Talk shop with verified service members who share your branch, state, career, or separation year.</p></div>
      {joined.size > 0 && <section><p className="eyebrow">Your groups</p><ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{all.filter((g) => joined.has(g.id)).map((g) => <Card key={g.id} g={g} />)}</ul></section>}
      {suggested.length > 0 && <section><p className="eyebrow">Suggested for you</p><ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{suggested.map((g) => <Card key={g.id} g={g} />)}</ul></section>}
      {KINDS.map(([k, label]) => (
        <section key={k}><p className="eyebrow">{label}</p>
          {k === 'state' ? (
            <details className="mt-3"><summary className="cursor-pointer text-sm text-navy">Show all states</summary><ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{all.filter((g) => g.kind === k).map((g) => <Card key={g.id} g={g} />)}</ul></details>
          ) : <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{all.filter((g) => g.kind === k).map((g) => <Card key={g.id} g={g} />)}</ul>}
        </section>
      ))}
    </div>
  );
}
