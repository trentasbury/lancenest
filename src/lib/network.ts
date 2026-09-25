import 'server-only';
import { createClient } from '@/lib/supabase/server';

export const POST_TYPES = [
  ['accomplishment', 'Accomplishment'], ['career', 'Career'], ['military', 'Military'], ['education', 'Education'],
  ['certification', 'Certification'], ['business', 'Business'], ['life_event', 'Life Event'], ['general', 'General Update'],
] as const;

export const MILESTONES_BY_TYPE: Record<string, [string, string][]> = {
  accomplishment: [['accomplishment', 'Accomplishment'], ['award', 'Award'], ['volunteer', 'Volunteer achievement']],
  career: [['new_job', 'Started a new position'], ['promotion', 'Promotion'], ['new_company', 'Joined a new company'], ['career_transition', 'Career transition']],
  military: [['military_promotion', 'Military promotion'], ['military_retirement', 'Retired from service'], ['service_anniversary', 'Service anniversary']],
  education: [['graduation', 'Graduation'], ['degree', 'Earned a degree'], ['training', 'Completed training']],
  certification: [['certification', 'Earned a certification']],
  business: [['new_business', 'Launched a business'], ['new_company', 'New company']],
  life_event: [['relocation', 'Relocation'], ['personal', 'Personal milestone'], ['volunteer', 'Volunteer achievement']],
  general: [],
};

export const MILESTONE_EYEBROW: Record<string, string> = {
  accomplishment: 'Accomplishment', career: 'Career Milestone', military: 'Service Milestone', education: 'Education Milestone',
  certification: 'Certification', business: 'Business Milestone', life_event: 'Life Event', general: 'Update',
};

export const REACTIONS = [
  ['support', 'Support', '✦'], ['congratulations', 'Congratulations', '★'], ['proud', 'Proud', '⚑'],
  ['inspiring', 'Inspiring', '✧'], ['thank_you', 'Thank You', '♥'], ['well_done', 'Well Done', '✓'],
] as const;

export const VISIBILITY = [
  ['network', 'Network', 'All LanceNest members'],
  ['connections', 'Connections', 'People you follow who follow you back'],
  ['public', 'Public', 'Anyone, including people without an account'],
  ['private', 'Private', 'Only you'],
] as const;

export const FEED_FILTERS = [
  ['', 'All'], ['accomplishment', 'Accomplishments'], ['career', 'Career'], ['military', 'Military'],
  ['education', 'Education'], ['business', 'Business'], ['life_event', 'Life Events'], ['photos', 'Photos'],
] as const;

function article(word: string) {
  if (/^[A-Z]{2,}/.test(word)) return 'AEFHILMNORSX'.includes(word[0]) ? 'an' : 'a';
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

/** Formats the milestone sentence shown on the card, e.g. "Started a new position as Program Manager at Acme". */
export function milestoneHeadline(m: string, f: { title?: string; organization?: string; location?: string }): string | null {
  const t = f.title?.trim();
  const o = f.organization?.trim();
  const at = o ? ` at ${o}` : '';
  switch (m) {
    case 'new_job': return `Started a new position${t ? ` as ${t}` : ''}${at}`;
    case 'promotion': return `Was promoted${t ? ` to ${t}` : ''}${at}`;
    case 'new_company': return o ? `Joined ${o}` : 'Joined a new company';
    case 'new_business': return `Launched ${o || 'a new business'}`;
    case 'certification': return `Earned ${t ? `the ${t} certification` : 'a new certification'}${o ? ` from ${o}` : ''}`;
    case 'graduation': return `Graduated${t ? ` with ${article(t)} ${t}` : ''}${o ? ` from ${o}` : ''}`;
    case 'degree': return `Earned ${t ? `${article(t)} ${t}` : 'a degree'}${o ? ` from ${o}` : ''}`;
    case 'award': return `Received ${t ? `the ${t}` : 'an award'}${o ? ` from ${o}` : ''}`;
    case 'military_promotion': return `Was promoted${t ? ` to ${t}` : ''}${o ? ` in the ${o}` : ''}`;
    case 'military_retirement': return `Retired${o ? ` from the ${o}` : ' from military service'}${t ? ` as ${article(t)} ${t}` : ''}`;
    case 'service_anniversary': return `Marked ${t || 'a service anniversary'}${o ? ` with the ${o}` : ''}`;
    case 'training': return `Completed ${t || 'training'}${o ? ` with ${o}` : ''}`;
    case 'career_transition': return `Transitioned${t ? ` into a new role as ${t}` : ' into a new career'}${at}`;
    case 'volunteer': return `Recognized for volunteer service${o ? ` with ${o}` : ''}`;
    case 'relocation': return `Relocated${f.location?.trim() ? ` to ${f.location.trim()}` : ''}`;
    case 'personal': return t || 'Reached a personal milestone';
    case 'accomplishment': return t || null;
    default: return null;
  }
}

export type Author = {
  id: string; full_name: string; username: string | null; headline: string | null;
  avatar_url: string | null; role: string; verified: boolean; service_summary: string | null;
};

export type Post = {
  id: string; author_id: string; post_type: string; milestone: string | null; headline: string | null; body: string;
  title: string | null; organization: string | null; location: string | null; event_date: string | null; visibility: string;
  shared_post_id: string | null; is_share: boolean; media_count: number; reaction_count: number; comment_count: number;
  share_count: number; edited_at: string | null; created_at: string;
  author: Author | null; media: { storage_path: string; position: number }[];
  shared?: Post | null;
  viewer?: { reaction: string | null; saved: boolean; followsAuthor: boolean; isAuthor: boolean };
};

const AUTHOR = 'author:profiles!network_posts_author_id_fkey(id, full_name, username, headline, avatar_url, role, verified, service_summary)';
const POST_SELECT = `*, ${AUTHOR}, media:post_media(storage_path, position)`;
export const PAGE_SIZE = 12;

export function mediaUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post-media/${path}`;
}

/** Cursor-paginated feed. Row-level security guarantees only posts the viewer may see are returned. */
export async function getFeed(opts: {
  viewerId: string | null; scope?: 'following' | 'everyone'; type?: string; cursor?: string;
  authorId?: string; savedOnly?: boolean; limit?: number;
}): Promise<{ posts: Post[]; nextCursor: string | null }> {
  const supabase = createClient();
  const limit = opts.limit ?? PAGE_SIZE;
  let q = supabase.from('network_posts').select(POST_SELECT);

  if (opts.viewerId && !opts.authorId) {
    const { data: muted } = await supabase.from('user_mutes').select('muted_id').eq('muter_id', opts.viewerId);
    const mutedIds = (muted ?? []).map((m) => m.muted_id as string);
    if (mutedIds.length) q = q.not('author_id', 'in', `(${mutedIds.join(',')})`);
  }
  if (opts.scope === 'following' && opts.viewerId) {
    const { data: f } = await supabase.from('user_follows').select('following_id').eq('follower_id', opts.viewerId);
    q = q.in('author_id', [opts.viewerId, ...(f ?? []).map((r) => r.following_id as string)]);
  }
  if (opts.savedOnly && opts.viewerId) {
    const { data: s } = await supabase.from('post_saves').select('post_id').eq('profile_id', opts.viewerId);
    const ids = (s ?? []).map((r) => r.post_id as string);
    if (!ids.length) return { posts: [], nextCursor: null };
    q = q.in('id', ids);
  }
  if (opts.authorId) q = q.eq('author_id', opts.authorId);
  if (opts.type === 'photos') q = q.gt('media_count', 0);
  else if (opts.type) q = q.eq('post_type', opts.type);
  if (opts.cursor && !Number.isNaN(Date.parse(opts.cursor))) q = q.lt('created_at', opts.cursor);

  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit + 1);
  if (error) {
    console.error('getFeed failed:', error.message);
    return { posts: [], nextCursor: null };
  }
  const rows = (data ?? []) as Post[];
  const page = rows.slice(0, limit);
  await decorate(page, opts.viewerId);
  return { posts: page, nextCursor: rows.length > limit ? page[page.length - 1].created_at : null };
}

export async function getPost(id: string, viewerId: string | null): Promise<Post | null> {
  const supabase = createClient();
  const { data } = await supabase.from('network_posts').select(POST_SELECT).eq('id', id).maybeSingle();
  if (!data) return null;
  const post = data as Post;
  await decorate([post], viewerId);
  return post;
}

/** Attaches shared originals and the viewer's own state (reaction, saved, following) in a few batched queries. */
async function decorate(posts: Post[], viewerId: string | null) {
  if (!posts.length) return;
  const supabase = createClient();
  posts.forEach((p) => p.media?.sort((a, b) => a.position - b.position));

  const sharedIds = Array.from(new Set(posts.map((p) => p.shared_post_id).filter(Boolean))) as string[];
  if (sharedIds.length) {
    const { data } = await supabase.from('network_posts').select(POST_SELECT).in('id', sharedIds);
    const byId = new Map(((data ?? []) as Post[]).map((p) => [p.id, p]));
    posts.forEach((p) => { if (p.is_share) p.shared = p.shared_post_id ? byId.get(p.shared_post_id) ?? null : null; });
  }

  const ids = posts.map((p) => p.id);
  const authorIds = Array.from(new Set(posts.map((p) => p.author_id)));
  const [reactions, saves, follows] = viewerId
    ? await Promise.all([
        supabase.from('post_reactions').select('post_id, reaction').eq('profile_id', viewerId).in('post_id', ids),
        supabase.from('post_saves').select('post_id').eq('profile_id', viewerId).in('post_id', ids),
        supabase.from('user_follows').select('following_id').eq('follower_id', viewerId).in('following_id', authorIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const myReaction = new Map((reactions.data ?? []).map((r) => [r.post_id as string, r.reaction as string]));
  const saved = new Set((saves.data ?? []).map((r) => r.post_id as string));
  const following = new Set((follows.data ?? []).map((r) => r.following_id as string));
  posts.forEach((p) => {
    p.viewer = {
      reaction: myReaction.get(p.id) ?? null,
      saved: saved.has(p.id),
      followsAuthor: following.has(p.author_id),
      isAuthor: viewerId === p.author_id,
    };
  });
}

export type Suggestion = { id: string; full_name: string; username: string | null; headline: string | null; service_summary: string | null; location: string | null; role: string; reason: string };

/** "Grow Your Network": simple, explainable matching on data members can already see. */
export async function getSuggestions(viewerId: string, limit = 5): Promise<Suggestion[]> {
  const supabase = createClient();
  const [{ data: me }, { data: following }, { data: blocks }, { data: mySkills }] = await Promise.all([
    supabase.from('profiles').select('service_summary, location').eq('id', viewerId).maybeSingle(),
    supabase.from('user_follows').select('following_id').eq('follower_id', viewerId),
    supabase.from('user_blocks').select('blocked_id').eq('blocker_id', viewerId),
    supabase.from('profile_skills').select('skill_id').eq('profile_id', viewerId),
  ]);
  const exclude = new Set([viewerId, ...(following ?? []).map((r) => r.following_id as string), ...(blocks ?? []).map((r) => r.blocked_id as string)]);

  const { data: pool } = await supabase
    .from('profiles')
    .select('id, full_name, username, headline, service_summary, location, role')
    .neq('role', 'admin')
    .order('created_at', { ascending: false })
    .limit(80);
  const candidates = (pool ?? []).filter((p) => !exclude.has(p.id as string)) as Omit<Suggestion, 'reason'>[];
  if (!candidates.length) return [];

  const skillIds = (mySkills ?? []).map((r) => r.skill_id as string);
  const shared = new Map<string, number>();
  if (skillIds.length) {
    const { data } = await supabase.from('profile_skills').select('profile_id').in('skill_id', skillIds).in('profile_id', candidates.map((c) => c.id));
    (data ?? []).forEach((r) => shared.set(r.profile_id as string, (shared.get(r.profile_id as string) ?? 0) + 1));
  }

  const myBranch = me?.service_summary?.split(' · ')[0]?.replace('U.S. ', '') ?? null;
  const myState = me?.location?.split(',').pop()?.trim().toLowerCase() ?? null;

  return candidates
    .map((c) => {
      const branch = c.service_summary?.split(' · ')[0]?.replace('U.S. ', '') ?? null;
      const state = c.location?.split(',').pop()?.trim().toLowerCase() ?? null;
      const skills = shared.get(c.id) ?? 0;
      let score = 0;
      const reasons: string[] = [];
      if (myBranch && branch === myBranch) { score += 3; reasons.push(`Also served in the ${branch}`); }
      if (myState && state === myState) { score += 2; reasons.push(`Also in ${c.location?.split(',').pop()?.trim()}`); }
      if (skills) { score += skills; reasons.push(`${skills} shared skill${skills > 1 ? 's' : ''}`); }
      return { ...c, score, reason: reasons[0] ?? (c.role === 'employer' ? 'Hiring veterans' : 'New to LanceNest') };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
