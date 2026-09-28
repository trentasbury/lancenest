import type { Metadata } from 'next';
import Link from 'next/link';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { sanitizeSearch } from '@/lib/format';
import Avatar from '@/components/network/Avatar';
import VerifiedMark from '@/components/VerifiedMark';
import SubmitButton from '@/components/SubmitButton';
import { startConversation } from '../actions';

export const metadata: Metadata = { title: 'New message' };

export default async function NewMessagePage({ searchParams }: { searchParams: { q?: string } }) {
  const { user } = await requireVerifiedMember('/messages/new');
  const q = sanitizeSearch(searchParams.q ?? '');
  const supabase = createClient();
  const [{ data: people }, { data: following }] = await Promise.all([
    q ? supabase.from('profiles').select('id, full_name, headline, avatar_url, verified, role').neq('id', user.id).or(`full_name.ilike.%${q}%,headline.ilike.%${q}%`).order('verified', { ascending: false }).limit(25)
      : Promise.resolve({ data: [] as { id: string; full_name: string; headline: string | null; avatar_url: string | null; verified: boolean; role: string }[] }),
    supabase.from('user_follows').select('following_id').eq('follower_id', user.id),
  ]);
  const followSet = new Set((following ?? []).map((f) => f.following_id as string));
  return (
    <div className="container-page max-w-2xl py-10">
      <Link href="/messages" className="text-sm text-muted hover:text-navy">← Messages</Link>
      <h1 className="mt-2 font-serif text-4xl font-medium">New message</h1>
      <form method="get" className="mt-6 flex gap-2">
        <input name="q" defaultValue={searchParams.q} autoFocus placeholder="Search by name or title" className="field" />
        <button className="btn btn-primary">Search</button>
      </form>
      <p className="mt-3 text-xs text-muted">If you’re not connected (following each other), you can send one message until they accept.</p>
      {q && (people ?? []).length === 0 && <p className="card mt-5 p-6 text-center text-sm text-muted">No members match “{searchParams.q}”.</p>}
      <ul className="mt-5 space-y-2">
        {(people ?? []).map((p) => (
          <li key={p.id} className="card flex items-center gap-3 p-4">
            <Avatar name={p.full_name} src={p.avatar_url} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.full_name}{p.verified && <VerifiedMark />}</p>
              <p className="truncate text-xs text-muted">{p.headline ?? (p.role === 'employer' ? 'Employer' : 'Member')}{followSet.has(p.id) ? ' · You follow' : ''}</p>
            </div>
            <form action={startConversation.bind(null, p.id)}><SubmitButton className="btn btn-primary px-3 py-1.5 text-xs" pendingText="…">Message</SubmitButton></form>
          </li>
        ))}
      </ul>
    </div>
  );
}
