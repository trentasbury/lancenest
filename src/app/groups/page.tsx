import type { Metadata } from 'next';
import Link from 'next/link';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { GROUP_CATEGORIES, GROUP_COLUMNS, OFFICIAL_KINDS, categoryLabel, groupCounts, type GroupRow } from '@/lib/groups';
import { joinGroup } from './actions';

export const metadata: Metadata = { title: 'Groups' };

export default async function GroupsPage(props: { searchParams: Promise<{ category?: string; started?: string; error?: string }> }) {
  const sp = await props.searchParams;
  const { user, profile } = await requireVerifiedMember('/groups');
  const supabase = await createClient();
  const [{ data: groups }, { data: mine }, { data: svc }, { data: vet }] = await Promise.all([
    supabase.from('groups').select(`${GROUP_COLUMNS}, review_note`).order('name'),
    supabase.from('group_members').select('group_id, status, role').eq('profile_id', user.id),
    supabase.from('military_service').select('branch').eq('profile_id', user.id),
    supabase.from('veteran_profiles').select('state, separation_date').eq('profile_id', user.id).maybeSingle(),
  ]);
  const all = (groups ?? []) as (GroupRow & { review_note: string | null })[];
  const live = all.filter((g) => g.status === 'approved');
  const size = await groupCounts(supabase, live.map((g) => g.id));
  const membership = new Map((mine ?? []).map((m) => [m.group_id as string, m as { status: string; role: string }]));
  const joined = live.filter((g) => membership.get(g.id)?.status === 'active');
  const myRequests = all.filter((g) => g.created_by === user.id && (g.status === 'pending' || g.status === 'rejected'));

  // Suggestions from the profile: branch (e.g. the Marine Corps group), state, and separation year.
  const branchSlugs = (svc ?? []).map((s) => String(s.branch).toLowerCase().replace(/\s+/g, '-'));
  const sepYear = vet?.separation_date ? new Date(vet.separation_date as string).getFullYear() : null;
  const suggested = live.filter((g) => g.kind && !membership.has(g.id) && (branchSlugs.includes(g.slug) || (vet?.state && g.slug === `state-${String(vet.state).toLowerCase()}`) || (sepYear && g.slug === `separating-${sepYear}`)));

  const category = GROUP_CATEGORIES.some((c) => c.value === sp.category) ? sp.category : undefined;
  const community = live.filter((g) => !g.kind && (!category || g.category === category));
  const canStart = profile.role === 'veteran' || profile.role === 'admin';

  const Card = ({ g }: { g: GroupRow }) => {
    const m = membership.get(g.id);
    const n = size.get(g.id) ?? 0;
    return (
      <li className="card flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <Link href={`/groups/${g.slug}`} className="font-medium text-navy hover:underline">{g.name}</Link>
          <p className="text-xs text-muted">
            {g.kind ? 'LanceNest group' : categoryLabel(g.category) ?? 'Member group'}
            {g.privacy === 'private' && ' · Private'} · {n} member{n === 1 ? '' : 's'}
          </p>
          {!g.kind && g.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{g.description}</p>}
        </div>
        {m?.status === 'active' ? <Link href={`/groups/${g.slug}`} className="shrink-0 text-xs text-olive">✓ Joined</Link>
          : m?.status === 'pending' ? <span className="shrink-0 text-xs text-muted">Requested</span>
          : g.privacy === 'private' ? <Link href={`/groups/${g.slug}`} className="btn btn-outline shrink-0 px-3 py-1.5 text-xs">Ask to join</Link>
          : <form action={joinGroup.bind(null, g.id, g.slug)}><SubmitButton className="btn btn-outline px-3 py-1.5 text-xs" pendingText="…">Join</SubmitButton></form>}
      </li>
    );
  };
  const Grid = ({ items }: { items: GroupRow[] }) => <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((g) => <Card key={g.id} g={g} />)}</ul>;
  const chip = (on: boolean) => `whitespace-nowrap rounded-full border px-4 py-1.5 text-sm ${on ? 'border-navy bg-navy text-ivory' : 'border-line bg-ivory text-ink hover:border-brass'}`;

  return (
    <div className="container-page max-w-5xl space-y-8 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl font-medium">Groups</h1>
          <p className="mt-1 max-w-2xl text-muted">Find your people. Join your branch and state, or a member-run group for your unit, your faith, your friends, or your family.</p>
        </div>
        {canStart && <Link href="/groups/new" className="btn btn-primary">Start a group</Link>}
      </div>

      {sp.started && <FormMessage message="Thanks. Your group is with LanceNest for review (usually within two business days). We’ll let you know, and you’ll be its owner once it’s approved." />}
      {sp.error === 'members_only' && <FormMessage error="Groups are started by verified service members, veterans and military spouses." />}

      {myRequests.length > 0 && (
        <section>
          <p className="eyebrow">Groups you started</p>
          <ul className="card mt-3 divide-y divide-line">
            {myRequests.map((g) => (
              <li key={g.id} className="p-4 text-sm">
                <span className="font-medium text-ink">{g.name}</span>{' '}
                <span className={g.status === 'rejected' ? 'text-signal' : 'text-muted'}>· {g.status === 'pending' ? 'Waiting for review' : 'Not approved'}</span>
                {g.status === 'rejected' && g.review_note && <p className="mt-1 text-xs text-muted">Note from LanceNest: {g.review_note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {joined.length > 0 && <section><p className="eyebrow">Your groups</p><Grid items={joined} /></section>}
      {suggested.length > 0 && <section><p className="eyebrow">Suggested for you</p><Grid items={suggested} /></section>}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">Community groups</p>
          <p className="text-xs text-muted">Started and run by members. Not affiliated with or endorsed by the DoD or any branch.</p>
        </div>
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Link href="/groups" className={chip(!category)}>All</Link>
          {GROUP_CATEGORIES.map((c) => <Link key={c.value} href={`/groups?category=${c.value}`} className={chip(category === c.value)}>{c.label}</Link>)}
        </div>
        {community.length > 0 ? <Grid items={community} /> : (
          <div className="card mt-3 p-6 text-center text-sm text-muted">
            {category ? 'No groups like this yet.' : 'No community groups yet.'}{' '}
            {canStart && <>Be the first: <Link href="/groups/new" className="text-navy underline">start one</Link>.</>}
          </div>
        )}
      </section>

      {OFFICIAL_KINDS.map(([k, label]) => (
        <section key={k}><p className="eyebrow">{label}</p>
          {k === 'state' ? (
            <details className="mt-3"><summary className="cursor-pointer text-sm text-navy">Show all states</summary><Grid items={live.filter((g) => g.kind === k)} /></details>
          ) : <Grid items={live.filter((g) => g.kind === k)} />}
        </section>
      ))}
    </div>
  );
}
