'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyMember } from '@/lib/email';
import { slugify } from '@/lib/format';
import { GROUP_CATEGORIES, reservedGroupName } from '@/lib/groups';

const text = (fd: FormData | undefined, k: string, max: number) => String(fd?.get(k) ?? '').trim().slice(0, max);
const flagged = async (t: string) => !!t && !!(await createAdminClient().rpc('screen_text', { t })).data;
const refresh = (slug: string) => { revalidatePath(`/groups/${slug}`); revalidatePath('/groups'); revalidatePath('/network'); };

// ---------------------------------------------------------------- joining

/** Open groups join at once; private groups send the owner a request (with an optional note). */
export async function joinGroup(groupId: string, slug: string, formData?: FormData) {
  const { user } = await requireVerifiedMember(`/groups/${slug}`);
  const note = text(formData, 'note', 300);
  if (note && (await flagged(note))) redirect(`/groups/${slug}?error=note`);
  const { error } = await (await createClient()).from('group_members').insert({ group_id: groupId, profile_id: user.id, request_note: note || null });
  if (error && error.code !== '23505') redirect(`/groups/${slug}?error=${error.code === 'P0027' ? 'closed' : 'join_failed'}`);
  refresh(slug);
}

export async function leaveGroup(groupId: string, slug: string) {
  const { user } = await requireVerifiedMember(`/groups/${slug}`);
  const { error } = await (await createClient()).from('group_members').delete().eq('group_id', groupId).eq('profile_id', user.id);
  if (error?.code === 'P0028') redirect(`/groups/${slug}?error=owner`);
  refresh(slug);
}

export async function postInGroup(groupId: string, slug: string, formData: FormData) {
  const { user } = await requireVerifiedMember(`/groups/${slug}`);
  const body = String(formData.get('body') ?? '').trim().slice(0, 3000);
  if (body.length < 2) redirect(`/groups/${slug}?error=empty`);
  const { error } = await (await createClient()).from('network_posts').insert({ author_id: user.id, body, group_id: groupId, post_type: 'general', visibility: 'network' });
  if (error) redirect(`/groups/${slug}?error=${error.code === 'P0017' ? 'join' : error.code === 'P0009' ? 'pii' : error.code === 'P0022' ? 'explicit' : 'post'}`);
  revalidatePath(`/groups/${slug}`);
  redirect(`/groups/${slug}`);
}

// ---------------------------------------------------------------- starting a group

/**
 * A verified member asks to start a group. It stays hidden until LanceNest approves it; the starter becomes its owner
 * on approval. Limits: two requests waiting at once, three started per 30 days.
 */
export async function createGroup(formData: FormData) {
  const { user, profile } = await requireVerifiedMember('/groups/new');
  if (profile.role !== 'veteran' && profile.role !== 'admin') redirect('/groups?error=members_only');
  const back = (code: string) => redirect(`/groups/new?error=${code}`);

  const name = text(formData, 'name', 80).replace(/\s+/g, ' ');
  const category = text(formData, 'category', 20);
  const privacy = formData.get('privacy') === 'private' ? 'private' : 'open';
  const description = text(formData, 'description', 500);
  const purpose = text(formData, 'purpose', 1000);
  if (formData.get('guidelines') !== 'on') back('guidelines');
  if (name.length < 3) back('name');
  if (!GROUP_CATEGORIES.some((c) => c.value === category)) back('category');
  if (description.length < 10) back('description');
  if (purpose.length < 20) back('purpose');
  if (reservedGroupName(name)) back('reserved');

  const admin = createAdminClient();
  const month = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ count: waiting }, { count: recent }, { data: sameName }] = await Promise.all([
    admin.from('groups').select('id', { count: 'exact', head: true }).eq('created_by', user.id).eq('status', 'pending'),
    admin.from('groups').select('id', { count: 'exact', head: true }).eq('created_by', user.id).gte('created_at', month),
    admin.from('groups').select('id').ilike('name', name.replace(/[%_\\]/g, (c) => `\\${c}`)).in('status', ['pending', 'approved']).limit(1),
  ]);
  if ((waiting ?? 0) >= 2) back('waiting');
  if ((recent ?? 0) >= 3) back('limit');
  if (sameName?.length) back('taken');
  if ((await flagged(name)) || (await flagged(description)) || (await flagged(purpose))) back('screen');

  // A readable address that never collides with another group's.
  const base = slugify(name) || 'group';
  let slug = base;
  for (let i = 2; i < 12; i++) {
    const { data: exists } = await admin.from('groups').select('id').eq('slug', slug).maybeSingle();
    if (!exists) break;
    slug = i < 11 ? `${base.slice(0, 56)}-${i}` : `${base.slice(0, 52)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const { error } = await admin.from('groups').insert({
    slug, name, kind: null, category, description, purpose, privacy, status: 'pending', created_by: user.id,
  });
  if (error) back('failed');
  revalidatePath('/groups');
  redirect('/groups?started=1');
}

// ---------------------------------------------------------------- running a group (owner and moderators)

async function manager(groupId: string, slug: string) {
  const { user, profile } = await requireVerifiedMember(`/groups/${slug}`);
  const admin = createAdminClient();
  const { data: me } = await admin.from('group_members').select('role, status').eq('group_id', groupId).eq('profile_id', user.id).maybeSingle();
  const role = profile.role === 'admin' ? 'owner' : me?.status === 'active' ? (me.role as string) : null;
  if (role !== 'owner' && role !== 'moderator') redirect(`/groups/${slug}?error=not_manager`);
  return { user, admin, role: role as 'owner' | 'moderator' };
}

export async function decideJoinRequest(groupId: string, slug: string, profileId: string, decision: 'approve' | 'decline') {
  const { admin } = await manager(groupId, slug);
  if (decision === 'approve') {
    const { data } = await admin.from('group_members').update({ status: 'active', request_note: null })
      .eq('group_id', groupId).eq('profile_id', profileId).eq('status', 'pending').select('profile_id').maybeSingle();
    if (data) {
      const { data: g } = await admin.from('groups').select('name').eq('id', groupId).maybeSingle();
      await notifyMember(profileId, { type: 'group_joined', link: `/groups/${slug}`, title: `You’re in. Welcome to ${String(g?.name ?? 'the group').slice(0, 60)}.` });
    }
  } else {
    await admin.from('group_members').delete().eq('group_id', groupId).eq('profile_id', profileId).eq('status', 'pending');
  }
  refresh(slug);
}

/** Moderators can remove members; only the owner can remove a moderator. Nobody removes the owner here. */
export async function removeGroupMember(groupId: string, slug: string, profileId: string) {
  const { user, admin, role } = await manager(groupId, slug);
  if (profileId === user.id) redirect(`/groups/${slug}?error=self`);
  const { data: target } = await admin.from('group_members').select('role').eq('group_id', groupId).eq('profile_id', profileId).maybeSingle();
  if (!target || target.role === 'owner' || (target.role === 'moderator' && role !== 'owner')) redirect(`/groups/${slug}?error=not_allowed`);
  await admin.from('group_members').delete().eq('group_id', groupId).eq('profile_id', profileId);
  refresh(slug);
}

/** Owner only: make someone a moderator, make them a member again, or hand the group to them. */
export async function setGroupRole(groupId: string, slug: string, profileId: string, next: 'moderator' | 'member' | 'owner') {
  const { user, admin, role } = await manager(groupId, slug);
  if (role !== 'owner' || profileId === user.id) redirect(`/groups/${slug}?error=not_allowed`);
  const { data: target } = await admin.from('group_members').select('role, status').eq('group_id', groupId).eq('profile_id', profileId).maybeSingle();
  if (!target || target.status !== 'active') redirect(`/groups/${slug}?error=not_allowed`);
  if (next === 'moderator') {
    const { count } = await admin.from('group_members').select('profile_id', { count: 'exact', head: true }).eq('group_id', groupId).eq('role', 'moderator');
    if ((count ?? 0) >= 10) redirect(`/groups/${slug}?error=mods`);
  }
  if (next === 'owner') {
    // Hand-off: the old owner stays on as a moderator.
    await admin.from('group_members').update({ role: 'moderator' }).eq('group_id', groupId).eq('role', 'owner');
    await admin.from('group_members').update({ role: 'owner' }).eq('group_id', groupId).eq('profile_id', profileId);
    await admin.from('groups').update({ created_by: profileId }).eq('id', groupId).is('kind', null);
    const { data: g } = await admin.from('groups').select('name').eq('id', groupId).maybeSingle();
    await notifyMember(profileId, { type: 'group_role', link: `/groups/${slug}`, title: `You’re now the owner of ${String(g?.name ?? 'a group').slice(0, 60)}.` });
  } else {
    await admin.from('group_members').update({ role: next }).eq('group_id', groupId).eq('profile_id', profileId).neq('role', 'owner');
  }
  refresh(slug);
}

/** Owner or moderator hides a post from the group. LanceNest can still see it and restore it. */
export async function hideGroupPost(groupId: string, slug: string, postId: string) {
  const { admin } = await manager(groupId, slug);
  await admin.from('network_posts').update({ hidden: true }).eq('id', postId).eq('group_id', groupId);
  refresh(slug);
}

/** Owner only: update the public description, or switch between open and private. The name changes through LanceNest. */
export async function updateGroupAbout(groupId: string, slug: string, formData: FormData) {
  const { admin, role } = await manager(groupId, slug);
  if (role !== 'owner') redirect(`/groups/${slug}?error=not_allowed`);
  const description = text(formData, 'description', 500);
  if (description.length < 10) redirect(`/groups/${slug}?error=description`);
  if (await flagged(description)) redirect(`/groups/${slug}?error=screen`);
  const privacy = formData.get('privacy') === 'private' ? 'private' : 'open';
  await admin.from('groups').update({ description, privacy }).eq('id', groupId).is('kind', null);
  refresh(slug);
  redirect(`/groups/${slug}?saved=1`);
}
