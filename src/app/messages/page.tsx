import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { timeAgo } from '@/lib/network';
import Avatar from '@/components/network/Avatar';
import EmptyState from '@/components/EmptyState';
import FormMessage from '@/components/FormMessage';

export const metadata: Metadata = { title: 'Messages' };

type Row = { conversation_id: string; profile_id: string; last_read_at: string | null; profile: { full_name: string; headline: string | null } | null };

export default async function MessagesPage({ searchParams }: { searchParams: { error?: string } }) {
  const { user } = await requireRole(['veteran', 'employer', 'admin'], '/messages');
  const supabase = createClient();

  const { data: mine } = await supabase.from('conversation_participants').select('conversation_id, last_read_at').eq('profile_id', user.id);
  const ids = (mine ?? []).map((r) => r.conversation_id as string);
  const lastRead = new Map((mine ?? []).map((r) => [r.conversation_id as string, r.last_read_at as string | null]));

  const [{ data: others }, { data: recent }, { data: convs }] = ids.length
    ? await Promise.all([
        supabase.from('conversation_participants').select('conversation_id, profile_id, last_read_at, profile:profiles!conversation_participants_profile_id_fkey(full_name, headline)').in('conversation_id', ids).neq('profile_id', user.id),
        supabase.from('messages').select('conversation_id, body, sender_id, created_at').in('conversation_id', ids).order('created_at', { ascending: false }).limit(Math.min(ids.length * 5, 500)),
        supabase.from('conversations').select('id, updated_at').in('id', ids).order('updated_at', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const otherBy = new Map(((others ?? []) as unknown as Row[]).map((r) => [r.conversation_id, r]));
  const lastBy = new Map<string, { body: string; sender_id: string; created_at: string }>();
  (recent ?? []).forEach((m) => { if (!lastBy.has(m.conversation_id as string)) lastBy.set(m.conversation_id as string, m as { body: string; sender_id: string; created_at: string }); });
  const list = (convs ?? []).filter((c) => lastBy.has(c.id as string));

  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="font-serif text-4xl font-medium">Messages</h1>
      <p className="mt-1 text-muted">Private conversations between you and other members.</p>
      {searchParams.error && (
        searchParams.error === 'credits' ? (
          <div className="card mt-4 border-brass p-5">
            <p className="font-medium">You’ve used your candidate contacts.</p>
            <p className="mt-1 text-sm text-muted">Candidates who apply to your jobs are always free to message. To reach out to others first, add contact credits or upgrade.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action="/api/billing/checkout" method="post"><input type="hidden" name="product" value="contact_pack" /><button className="btn btn-outline">5 contacts · $59</button></form>
              <Link href="/employers" className="btn btn-primary">See plans</Link>
            </div>
          </div>
        ) : (
          <div className="mt-4"><FormMessage error={searchParams.error === 'blocked' ? 'You can’t message this member.' : 'That conversation couldn’t be started. Please try again.'} /></div>
        )
      )}
      <div className="mt-6">
        {list.length === 0 ? (
          <EmptyState title="No messages." body="When an employer or another member reaches out, you’ll see it here. You can start a conversation from anyone’s profile." action={{ href: '/network', label: 'Go to your network' }} />
        ) : (
          <ul className="card divide-y divide-line">
            {list.map((c) => {
              const other = otherBy.get(c.id as string);
              const last = lastBy.get(c.id as string)!;
              const read = lastRead.get(c.id as string);
              const unread = last.sender_id !== user.id && (!read || new Date(read) < new Date(last.created_at));
              return (
                <li key={c.id as string}>
                  <Link href={`/messages/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-paper">
                    <Avatar name={other?.profile?.full_name} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate ${unread ? 'font-semibold text-ink' : 'text-ink'}`}>{other?.profile?.full_name ?? 'Member'}</p>
                      <p className={`truncate text-sm ${unread ? 'text-ink' : 'text-muted'}`}>{last.sender_id === user.id ? 'You: ' : ''}{last.body}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-muted">{timeAgo(last.created_at)}</span>
                      {unread && <span className="h-2.5 w-2.5 rounded-full bg-brass" aria-label="Unread" />}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
