import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getFeed } from '@/lib/network';
import PostCard from '@/components/network/PostCard';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { joinGroup, leaveGroup, postInGroup } from '../actions';

export const metadata: Metadata = { title: 'Group' };
const ERR: Record<string, string> = { join: 'Join the group to post.', pii: 'Posts can’t include Social Security numbers.', empty: 'Write something first.', post: 'That didn’t post — please try again.' };

export default async function GroupPage({ params, searchParams }: { params: { slug: string }; searchParams: { error?: string } }) {
  const { user } = await requireVerifiedMember(`/groups/${params.slug}`);
  const supabase = createClient();
  const { data: g } = await supabase.from('groups').select('id, slug, name, description').eq('slug', params.slug).maybeSingle();
  if (!g) notFound();
  const [{ count }, { data: me }, feed] = await Promise.all([
    supabase.from('group_members').select('profile_id', { count: 'exact', head: true }).eq('group_id', g.id),
    supabase.from('group_members').select('profile_id').eq('group_id', g.id).eq('profile_id', user.id).maybeSingle(),
    getFeed({ viewerId: user.id, scope: 'everyone', groupId: g.id as string }),
  ]);
  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <Link href="/groups" className="text-sm text-muted hover:text-navy">← Groups</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-serif text-4xl font-medium">{g.name as string}</h1><p className="mt-1 text-muted">{g.description as string} · {count ?? 0} member{count === 1 ? '' : 's'}</p></div>
        {me ? <form action={leaveGroup.bind(null, g.id as string, g.slug as string)}><button className="text-sm text-muted hover:text-signal">Leave group</button></form>
          : <form action={joinGroup.bind(null, g.id as string, g.slug as string)}><SubmitButton className="btn btn-primary" pendingText="…">Join group</SubmitButton></form>}
      </div>
      {searchParams.error && <FormMessage error={ERR[searchParams.error] ?? ERR.post} />}
      {me && (
        <form action={postInGroup.bind(null, g.id as string, g.slug as string)} className="card space-y-3 p-5">
          <textarea name="body" required rows={3} maxLength={3000} placeholder={`Share with ${g.name as string}…`} className="field" />
          <div className="flex items-center justify-between"><p className="text-xs text-muted">OPSEC: no classified information, locations, or movements.</p><SubmitButton className="btn btn-primary" pendingText="Posting…">Post</SubmitButton></div>
        </form>
      )}
      {feed.posts.length === 0 ? <p className="card p-8 text-center text-muted">No posts yet — start the conversation.</p> : feed.posts.map((post) => <PostCard key={post.id} post={post} signedIn />)}
    </div>
  );
}
