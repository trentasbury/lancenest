'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function joinGroup(groupId: string, slug: string) {
  const { user } = await requireVerifiedMember('/groups');
  await createClient().from('group_members').insert({ group_id: groupId, profile_id: user.id });
  revalidatePath(`/groups/${slug}`); revalidatePath('/groups');
}

export async function leaveGroup(groupId: string, slug: string) {
  const { user } = await requireVerifiedMember('/groups');
  await createClient().from('group_members').delete().eq('group_id', groupId).eq('profile_id', user.id);
  revalidatePath(`/groups/${slug}`); revalidatePath('/groups');
}

export async function postInGroup(groupId: string, slug: string, formData: FormData) {
  const { user } = await requireVerifiedMember(`/groups/${slug}`);
  const body = String(formData.get('body') ?? '').trim().slice(0, 3000);
  if (body.length < 2) redirect(`/groups/${slug}?error=empty`);
  const { error } = await createClient().from('network_posts').insert({ author_id: user.id, body, group_id: groupId, post_type: 'general', visibility: 'network' });
  if (error) redirect(`/groups/${slug}?error=${error.code === 'P0017' ? 'join' : error.code === 'P0009' ? 'pii' : 'post'}`);
  revalidatePath(`/groups/${slug}`);
  redirect(`/groups/${slug}`);
}
