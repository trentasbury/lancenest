'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { MILESTONES_BY_TYPE, POST_TYPES, REACTIONS, VISIBILITY, milestoneHeadline } from '@/lib/network';

async function me(next = '/network') {
  const session = await getSessionProfile();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  return session.user.id;
}
const t = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? '').trim().slice(0, max);
const refresh = () => revalidatePath('/', 'layout');
const pick = (value: string, allowed: readonly (readonly string[])[], fallback: string) =>
  allowed.some((a) => a[0] === value) ? value : fallback;

export type PostState = { error?: string; ok?: boolean };

export async function createPost(formData: FormData): Promise<PostState> {
  const uid = await me();
  const supabase = createClient();
  const post_type = pick(t(formData, 'post_type', 20), POST_TYPES, 'general');
  const milestoneRaw = t(formData, 'milestone', 30);
  const milestone = (MILESTONES_BY_TYPE[post_type] ?? []).some(([v]) => v === milestoneRaw) ? milestoneRaw : null;
  const title = t(formData, 'title', 140);
  const organization = t(formData, 'organization', 140);
  const location = t(formData, 'location', 120);
  const body = t(formData, 'body', 3000);
  const date = t(formData, 'event_date', 10);
  const visibility = pick(t(formData, 'visibility', 12), VISIBILITY, 'network');

  let media: string[] = [];
  try {
    media = JSON.parse(String(formData.get('media') ?? '[]'));
  } catch {
    media = [];
  }
  // Only accept files the uploader placed in their own folder.
  media = (Array.isArray(media) ? media : []).filter((p) => typeof p === 'string' && p.startsWith(`${uid}/`)).slice(0, 4);

  const headline = milestone ? milestoneHeadline(milestone, { title, organization, location }) : null;
  if (!body && !headline && !media.length) return { error: 'Write something, choose a milestone, or add a photo.' };

  const { data, error } = await supabase
    .from('network_posts')
    .insert({
      author_id: uid, post_type, milestone, headline, body,
      title: title || null, organization: organization || null, location: location || null,
      event_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null, visibility,
    })
    .select('id')
    .single();
  if (error || !data) {
    console.error('createPost failed:', error?.message);
    return { error: 'Your post couldn’t be published. Please try again.' };
  }
  if (media.length) {
    await supabase.from('post_media').insert(media.map((storage_path, position) => ({ post_id: data.id, storage_path, position })));
  }
  refresh();
  return { ok: true };
}

export async function updatePost(postId: string, formData: FormData) {
  const uid = await me();
  await createClient()
    .from('network_posts')
    .update({ body: t(formData, 'body', 3000), visibility: pick(t(formData, 'visibility', 12), VISIBILITY, 'network'), edited_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('author_id', uid);
  refresh();
}

export async function deletePost(postId: string, formData: FormData) {
  const uid = await me();
  const supabase = createClient();
  const { data: media } = await supabase.from('post_media').select('storage_path').eq('post_id', postId);
  const { error } = await supabase.from('network_posts').delete().eq('id', postId).eq('author_id', uid);
  if (!error && media?.length) await supabase.storage.from('post-media').remove(media.map((m) => m.storage_path as string));
  refresh();
  if (formData.get('redirect') === 'feed') redirect('/network');
}

export async function reactToPost(postId: string, reaction: string) {
  const uid = await me();
  if (!REACTIONS.some(([v]) => v === reaction)) return;
  const supabase = createClient();
  const { data: existing } = await supabase.from('post_reactions').select('reaction').eq('post_id', postId).eq('profile_id', uid).maybeSingle();
  if (!existing) await supabase.from('post_reactions').insert({ post_id: postId, profile_id: uid, reaction });
  else if (existing.reaction === reaction) await supabase.from('post_reactions').delete().eq('post_id', postId).eq('profile_id', uid);
  else await supabase.from('post_reactions').update({ reaction }).eq('post_id', postId).eq('profile_id', uid);
  refresh();
}

export async function toggleSavePost(postId: string) {
  const uid = await me();
  const supabase = createClient();
  const { data } = await supabase.from('post_saves').select('post_id').eq('post_id', postId).eq('profile_id', uid).maybeSingle();
  if (data) await supabase.from('post_saves').delete().eq('post_id', postId).eq('profile_id', uid);
  else await supabase.from('post_saves').insert({ post_id: postId, profile_id: uid });
  refresh();
}

export async function sharePost(postId: string, formData: FormData) {
  const uid = await me();
  const { error } = await createClient().from('network_posts').insert({
    author_id: uid, is_share: true, shared_post_id: postId, post_type: 'general',
    body: t(formData, 'body', 3000), visibility: pick(t(formData, 'visibility', 12), VISIBILITY, 'network'),
  });
  if (error) console.error('sharePost failed:', error.message);
  refresh();
}

export async function addComment(postId: string, formData: FormData) {
  const uid = await me(`/network/${postId}`);
  const body = t(formData, 'body', 2000);
  if (!body) return;
  const parent = t(formData, 'parent_id', 40);
  await createClient().from('post_comments').insert({ post_id: postId, author_id: uid, body, parent_id: parent || null });
  refresh();
}

export async function updateComment(commentId: string, formData: FormData) {
  const uid = await me();
  const body = t(formData, 'body', 2000);
  if (!body) return;
  await createClient().from('post_comments').update({ body, edited_at: new Date().toISOString() }).eq('id', commentId).eq('author_id', uid);
  refresh();
}

export async function deleteComment(commentId: string) {
  await me();
  // Row-level security allows the comment's author or the post's author to delete.
  await createClient().from('post_comments').delete().eq('id', commentId);
  refresh();
}

const REPORT_REASONS = ['spam', 'harassment', 'fraud', 'fake_information', 'inappropriate', 'impersonation', 'other'];

export async function reportContent(targetType: 'post' | 'comment' | 'profile' | 'message', targetId: string, formData: FormData) {
  const uid = await me();
  const reason = t(formData, 'reason', 30);
  if (!REPORT_REASONS.includes(reason)) return;
  await createClient().from('reports').insert({ reporter_id: uid, target_type: targetType, target_id: targetId, reason, details: t(formData, 'details', 1000) || null });
  refresh();
}

export async function followUser(targetId: string) {
  const uid = await me();
  if (uid !== targetId) await createClient().from('user_follows').upsert({ follower_id: uid, following_id: targetId }, { ignoreDuplicates: true });
  refresh();
}

export async function unfollowUser(targetId: string) {
  const uid = await me();
  await createClient().from('user_follows').delete().eq('follower_id', uid).eq('following_id', targetId);
  refresh();
}

export async function muteUser(targetId: string) {
  const uid = await me();
  if (uid !== targetId) await createClient().from('user_mutes').upsert({ muter_id: uid, muted_id: targetId }, { ignoreDuplicates: true });
  refresh();
}

export async function unmuteUser(targetId: string) {
  const uid = await me();
  await createClient().from('user_mutes').delete().eq('muter_id', uid).eq('muted_id', targetId);
  refresh();
}

export async function blockUser(targetId: string) {
  const uid = await me();
  if (uid !== targetId) await createClient().from('user_blocks').upsert({ blocker_id: uid, blocked_id: targetId }, { ignoreDuplicates: true });
  refresh();
}

export async function unblockUser(targetId: string) {
  const uid = await me();
  await createClient().from('user_blocks').delete().eq('blocker_id', uid).eq('blocked_id', targetId);
  refresh();
}

/** "Share this with your network?" — only ever runs when the member confirms. */
export async function shareProfileMilestone(kind: 'experience' | 'education' | 'service', recordId: string, formData: FormData) {
  const uid = await me('/dashboard/profile');
  const supabase = createClient();
  const visibility = pick(t(formData, 'visibility', 12), VISIBILITY, 'network');
  let post: { post_type: string; milestone: string; headline: string | null; title?: string | null; organization?: string | null } | null = null;

  if (kind === 'experience') {
    const { data: e } = await supabase.from('experience').select('position, company').eq('id', recordId).eq('profile_id', uid).maybeSingle();
    if (e) post = { post_type: 'career', milestone: 'new_job', headline: milestoneHeadline('new_job', { title: e.position, organization: e.company }), title: e.position, organization: e.company };
  } else if (kind === 'education') {
    const { data: e } = await supabase.from('education').select('school, degree, field').eq('id', recordId).eq('profile_id', uid).maybeSingle();
    if (e) {
      const degree = [e.degree, e.field ? `in ${e.field}` : null].filter(Boolean).join(' ');
      post = { post_type: 'education', milestone: 'graduation', headline: milestoneHeadline('graduation', { title: degree, organization: e.school }), title: degree || null, organization: e.school };
    }
  } else {
    const { data: s } = await supabase.from('military_service').select('branch, rank, start_date, end_date').eq('id', recordId).eq('profile_id', uid).maybeSingle();
    if (s?.end_date) {
      const years = s.start_date ? Number(s.end_date.slice(0, 4)) - Number(s.start_date.slice(0, 4)) : null;
      const branch = `U.S. ${s.branch}`;
      const retired = years !== null && years >= 20;
      post = {
        post_type: 'military',
        milestone: retired ? 'military_retirement' : 'career_transition',
        headline: retired
          ? `Retired from the ${branch} after ${years} years of service`
          : `Completed ${years && years > 0 ? `${years} year${years > 1 ? 's' : ''} of ` : ''}service in the ${branch}`,
        title: s.rank,
        organization: branch,
      };
    }
  }
  if (post) await supabase.from('network_posts').insert({ author_id: uid, body: t(formData, 'body', 3000), visibility, ...post });
  refresh();
  redirect('/network');
}
