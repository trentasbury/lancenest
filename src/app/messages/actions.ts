'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/** Opens (or reuses) a one-to-one conversation. Auth + block checks run before the service-role client is used. */
export async function startConversation(otherId: string) {
  const session = await getSessionProfile();
  if (!session) redirect('/login?next=/messages');
  const me = session.user.id;
  if (me === otherId) redirect('/messages');

  const admin = createAdminClient();
  const [{ data: other }, { data: blocked }] = await Promise.all([
    admin.from('profiles').select('id').eq('id', otherId).maybeSingle(),
    admin.from('user_blocks').select('blocker_id')
      .or(`and(blocker_id.eq.${me},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${me})`).limit(1),
  ]);
  if (!other) redirect('/messages');
  if (blocked?.length) redirect('/messages?error=blocked');

  const { data: mine } = await admin.from('conversation_participants').select('conversation_id').eq('profile_id', me);
  const myConvs = (mine ?? []).map((r) => r.conversation_id as string);
  if (myConvs.length) {
    const { data: shared } = await admin.from('conversation_participants').select('conversation_id').eq('profile_id', otherId).in('conversation_id', myConvs).limit(1);
    if (shared?.length) redirect(`/messages/${shared[0].conversation_id}`);
  }

  const { data: conv, error } = await admin.from('conversations').insert({}).select('id').single();
  if (error || !conv) redirect('/messages?error=start');
  await admin.from('conversation_participants').insert([
    { conversation_id: conv.id, profile_id: me, last_read_at: new Date().toISOString() },
    { conversation_id: conv.id, profile_id: otherId },
  ]);
  redirect(`/messages/${conv.id}`);
}

export async function sendMessage(conversationId: string, formData: FormData) {
  const session = await getSessionProfile();
  if (!session) redirect('/login?next=/messages');
  const body = String(formData.get('body') ?? '').trim().slice(0, 4000);
  if (!body) return;
  // Row-level security confirms participation; a database trigger refuses blocked senders and sends the notification.
  const { error } = await createClient().from('messages').insert({ conversation_id: conversationId, sender_id: session.user.id, body });
  if (error) redirect(`/messages/${conversationId}?error=${error.message.includes('can’t') || error.message.includes("can't") ? 'blocked' : 'send'}`);
  revalidatePath('/', 'layout');
}
