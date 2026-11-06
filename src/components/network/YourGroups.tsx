import Link from 'next/link';
import SubmitButton from '@/components/SubmitButton';
import { joinGroup } from '@/app/groups/actions';
import { categoryLabel, type GroupRow } from '@/lib/groups';

type Joined = GroupRow & { role: string };

/** Network home: the member's groups first (their branch, unit, faith or friends), then a few to join. */
export default function YourGroups({ joined, suggested, requested }: { joined: Joined[]; suggested: GroupRow[]; requested: Set<string> }) {
  const label = (g: GroupRow) => (g.kind ? 'LanceNest group' : categoryLabel(g.category) ?? 'Member group') + (g.privacy === 'private' ? ' · Private' : '');
  // Their own community groups first, then branch / state / career / class.
  const ordered = [...joined].sort((a, b) => Number(!!a.kind) - Number(!!b.kind) || a.name.localeCompare(b.name));
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-sans text-base font-semibold text-ink">Your groups</h2>
        <Link href="/groups" className="text-xs text-navy hover:underline">See all</Link>
      </div>
      {ordered.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Join your branch, your state, or a group for your unit, faith or friends.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {ordered.slice(0, 8).map((g) => (
            <li key={g.id} className="min-w-0">
              <Link href={`/groups/${g.slug}`} className="block truncate text-sm font-medium text-navy hover:underline">{g.name}</Link>
              <span className="block text-xs text-muted">{label(g)}{g.role !== 'member' ? ` · ${g.role === 'owner' ? 'Owner' : 'Moderator'}` : ''}</span>
            </li>
          ))}
          {ordered.length > 8 && <li><Link href="/groups" className="text-xs text-muted hover:text-navy">and {ordered.length - 8} more</Link></li>}
        </ul>
      )}

      {suggested.length > 0 && (
        <>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Suggested for you</p>
          <ul className="mt-2 space-y-2.5">
            {suggested.slice(0, 3).map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2">
                <Link href={`/groups/${g.slug}`} className="min-w-0 truncate text-sm text-ink hover:underline">{g.name}</Link>
                {requested.has(g.id) ? <span className="text-xs text-muted">Requested</span>
                  : <form action={joinGroup.bind(null, g.id, g.slug)}><SubmitButton className="btn btn-outline px-3 py-1 text-xs" pendingText="…">Join</SubmitButton></form>}
              </li>
            ))}
          </ul>
        </>
      )}
      <Link href="/groups/new" className="mt-5 block text-xs text-navy hover:underline">+ Start a group for your unit, faith or friends</Link>
    </div>
  );
}
