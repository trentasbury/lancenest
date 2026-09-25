import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { timeAgo } from '@/lib/network';
import EmptyState from '@/components/EmptyState';

export const metadata: Metadata = { title: 'Notifications' };

const ICON: Record<string, string> = {
  post_reaction: '✦', post_comment: '❝', comment_reply: '↩', post_share: '⇪', follow: '＋', mention: '@', message: '✉',
};

export default async function NotificationsPage() {
  const { user } = await requireRole(['veteran', 'employer', 'admin'], '/notifications');
  const supabase = createClient();
  const { data } = await supabase.from('notifications').select('id, type, title, link, read_at, created_at').eq('profile_id', user.id).order('created_at', { ascending: false }).limit(60);
  // Opening the page marks everything as read.
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('profile_id', user.id).is('read_at', null);

  return (
    <div className="container-page max-w-2xl py-10">
      <h1 className="font-serif text-4xl font-medium">Notifications</h1>
      <div className="mt-6">
        {(data ?? []).length === 0 ? (
          <EmptyState title="Nothing new." body="Reactions, comments, follows, mentions, and messages will show up here." action={{ href: '/network', label: 'Go to your network' }} />
        ) : (
          <ul className="card divide-y divide-line">
            {(data ?? []).map((n) => (
              <li key={n.id}>
                <Link href={n.link ?? '/network'} className={`flex items-center gap-3 p-4 hover:bg-paper ${n.read_at ? '' : 'bg-brass/5'}`}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brass/50 text-brass-dark">{ICON[n.type as string] ?? '•'}</span>
                  <span className={`flex-1 text-sm ${n.read_at ? 'text-ink/80' : 'font-medium text-ink'}`}>{n.title}</span>
                  <span className="text-xs text-muted">{timeAgo(n.created_at as string)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
