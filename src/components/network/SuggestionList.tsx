import Link from 'next/link';
import type { Suggestion } from '@/lib/network';
import { followUser } from '@/app/network/actions';
import SubmitButton from '@/components/SubmitButton';
import Avatar from './Avatar';

export default function SuggestionList({ people }: { people: Suggestion[] }) {
  if (!people.length) return <p className="text-sm text-muted">As more members join, people you may know will appear here.</p>;
  return (
    <ul className="space-y-4">
      {people.map((p) => (
        <li key={p.id} className="flex items-start gap-3">
          <Avatar name={p.full_name} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">
              {p.role === 'veteran' && p.username ? <Link href={`/veterans/${p.username}`} className="hover:underline">{p.full_name}</Link> : p.full_name}
            </p>
            {(p.headline || p.service_summary) && <p className="truncate text-xs text-muted">{p.headline ?? p.service_summary}</p>}
            <p className="text-xs text-brass-dark">{p.reason}</p>
          </div>
          <form action={followUser.bind(null, p.id)}>
            <SubmitButton className="btn btn-outline px-3 py-1.5 text-xs" pendingText="…">Follow</SubmitButton>
          </form>
        </li>
      ))}
    </ul>
  );
}
