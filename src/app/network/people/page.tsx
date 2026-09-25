import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import Avatar from '@/components/network/Avatar';
import SubmitButton from '@/components/SubmitButton';
import { followUser, unblockUser, unfollowUser, unmuteUser } from '../actions';

export const metadata: Metadata = { title: 'Your network' };

type Person = { id: string; full_name: string; username: string | null; headline: string | null; service_summary: string | null; role: string };
const P = 'id, full_name, username, headline, service_summary, role';

export default async function PeoplePage({ searchParams }: { searchParams: { tab?: string } }) {
  const { user } = await requireRole(['veteran', 'employer', 'admin'], '/network/people');
  const tab = ['followers', 'following', 'muted', 'blocked'].includes(searchParams.tab ?? '') ? searchParams.tab! : 'following';
  const supabase = createClient();

  const { data: myFollows } = await supabase.from('user_follows').select('following_id').eq('follower_id', user.id);
  const followingSet = new Set((myFollows ?? []).map((r) => r.following_id as string));

  let people: Person[] = [];
  if (tab === 'followers') {
    const { data } = await supabase.from('user_follows').select(`p:profiles!user_follows_follower_id_fkey(${P})`).eq('following_id', user.id).limit(200);
    people = ((data ?? []) as unknown as { p: Person }[]).map((r) => r.p).filter(Boolean);
  } else if (tab === 'following') {
    const { data } = await supabase.from('user_follows').select(`p:profiles!user_follows_following_id_fkey(${P})`).eq('follower_id', user.id).limit(200);
    people = ((data ?? []) as unknown as { p: Person }[]).map((r) => r.p).filter(Boolean);
  } else if (tab === 'muted') {
    const { data } = await supabase.from('user_mutes').select(`p:profiles!user_mutes_muted_id_fkey(${P})`).eq('muter_id', user.id);
    people = ((data ?? []) as unknown as { p: Person }[]).map((r) => r.p).filter(Boolean);
  } else {
    const { data } = await supabase.from('user_blocks').select(`p:profiles!user_blocks_blocked_id_fkey(${P})`).eq('blocker_id', user.id);
    people = ((data ?? []) as unknown as { p: Person }[]).map((r) => r.p).filter(Boolean);
  }

  const tabs = [['following', 'Following'], ['followers', 'Followers'], ['muted', 'Muted'], ['blocked', 'Blocked']];
  return (
    <div className="container-page max-w-3xl py-10">
      <Link href="/network" className="text-sm text-muted hover:text-navy">← Network</Link>
      <h1 className="mt-3 font-serif text-4xl font-medium">Your network</h1>
      <div className="mt-6 flex gap-2 overflow-x-auto">
        {tabs.map(([v, l]) => (
          <Link key={v} href={`/network/people?tab=${v}`} className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm ${tab === v ? 'border-navy bg-navy text-ivory' : 'border-line bg-ivory hover:border-brass'}`}>{l}</Link>
        ))}
      </div>
      <ul className="card mt-6 divide-y divide-line">
        {people.length === 0 && <li className="p-6 text-center text-sm text-muted">No one here yet.</li>}
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-3 p-4">
            <Avatar name={p.full_name} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.role === 'veteran' && p.username ? <Link href={`/veterans/${p.username}`} className="hover:underline">{p.full_name}</Link> : p.full_name}</p>
              <p className="truncate text-xs text-muted">{[p.headline, p.service_summary].filter(Boolean).join(' · ')}</p>
            </div>
            {tab === 'muted' ? (
              <form action={unmuteUser.bind(null, p.id)}><SubmitButton className="btn btn-outline px-3 py-1.5 text-xs" pendingText="…">Unmute</SubmitButton></form>
            ) : tab === 'blocked' ? (
              <form action={unblockUser.bind(null, p.id)}><SubmitButton className="btn btn-outline px-3 py-1.5 text-xs" pendingText="…">Unblock</SubmitButton></form>
            ) : followingSet.has(p.id) ? (
              <form action={unfollowUser.bind(null, p.id)}><SubmitButton className="btn btn-outline px-3 py-1.5 text-xs" pendingText="…">Following ✓</SubmitButton></form>
            ) : (
              <form action={followUser.bind(null, p.id)}><SubmitButton className="btn btn-primary px-3 py-1.5 text-xs" pendingText="…">Follow back</SubmitButton></form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
