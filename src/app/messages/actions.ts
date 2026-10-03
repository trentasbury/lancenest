'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/** Opens (or reuses) a one-to-one conversation. Auth + block checks run before the service-role client is used. */
export async function startConversation(otherId: string, formData?: FormData) {
  const draft = formData ? String(formData.get('draft') ?? '').slice(0, 1000) : '';
  const q = draft ? `?draft=${encodeURIComponent(draft)}` : '';
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
    if (shared?.length) redirect(`/messages/${shared[0].conversation_id}${q}`);
  }

  // Messaging is free for everyone. Employers must be a verified company to start a conversation with a service member.
  const [{ data: meP }, { data: otherP }] = await Promise.all([
    admin.from('profiles').select('role').eq('id', me).maybeSingle(),
    admin.from('profiles').select('role').eq('id', otherId).maybeSingle(),
  ]);
  if (meP?.role === 'employer' && otherP?.role === 'veteran') {
    const { data: owned } = await admin.from('companies').select('is_verified').eq('owner_id', me).maybeSingle();
    const { data: membership } = owned ? { data: null } : await admin.from('company_members').select('company:companies(is_verified)').eq('profile_id', me).maybeSingle();
    const company = owned ?? (membership as unknown as { company: { is_verified: boolean } | null } | null)?.company ?? null;
    if (!company?.is_verified) redirect('/employer/dashboard?verify=required');
    const { data: hiddenRow } = await admin.from('hidden_companies').select('profile_id').eq('profile_id', otherId).in('company_id', (await admin.from('company_members').select('company_id').eq('profile_id', me)).data?.map((r) => r.company_id as string).concat((await admin.from('companies').select('id').eq('owner_id', me)).data?.map((r) => r.id as string) ?? []) ?? []).maybeSingle();
    if (hiddenRow) redirect('/messages?error=unavailable');
  }

  // Connections (mutual follows) and freelance contract partners message freely; everyone else starts with a request.
  const [{ count: iFollow }, { count: theyFollow }, { count: contracts }] = await Promise.all([
    admin.from('user_follows').select('follower_id', { count: 'exact', head: true }).eq('follower_id', me).eq('following_id', otherId),
    admin.from('user_follows').select('follower_id', { count: 'exact', head: true }).eq('follower_id', otherId).eq('following_id', me),
    admin.from('contracts').select('id', { count: 'exact', head: true }).or(`and(client_id.eq.${me},freelancer_id.eq.${otherId}),and(client_id.eq.${otherId},freelancer_id.eq.${me})`),
  ]);
  const open = ((iFollow ?? 0) > 0 && (theyFollow ?? 0) > 0) || (contracts ?? 0) > 0;
  const { data: conv, error } = await admin.from('conversations').insert(open ? {} : { status: 'request', requested_by: me }).select('id').single();
  if (error || !conv) redirect('/messages?error=start');
  await admin.from('conversation_participants').insert([
    { conversation_id: conv.id, profile_id: me, last_read_at: new Date().toISOString() },
    { conversation_id: conv.id, profile_id: otherId },
  ]);
  redirect(`/messages/${conv.id}${q}`);
}

export async function sendMessage(conversationId: string, formData: FormData) {
  const session = await getSessionProfile();
  if (!session) redirect('/login?next=/messages');
  const body = String(formData.get('body') ?? '').trim().slice(0, 4000);
  if (!body) return;
  // Row-level security confirms participation; a database trigger refuses blocked senders and sends the notification.
  const { error } = await createClient().from('messages').insert({ conversation_id: conversationId, sender_id: session.user.id, body });
  if (error) {
    const reason = error.code === 'P0015' ? 'pending' : error.code === 'P0016' ? 'declined' : error.code === 'P0009' ? 'pii' : error.code === 'P0002' ? 'rate' : error.message.includes("can't") ? 'blocked' : 'send';
  
  // Email the other person if they're away (throttled per conversation).
  try {
    const admin = createAdminClient();
    const { data: others } = await admin.from('conversation_participants').select('profile_id, last_emailed_at, profile:profiles(last_active_at)').eq('conversation_id', conversationId).neq('profile_id', session.user.id);
    for (const o of (others ?? []) as unknown as { profile_id: string; last_emailed_at: string | null; profile: { last_active_at: string | null } | null }[]) {
      const away = !o.profile?.last_active_at || Date.now() - Date.parse(o.profile.last_active_at) > 15 * 60000;
      const quiet = !o.last_emailed_at || Date.now() - Date.parse(o.last_emailed_at) > 2 * 3600000;
      if (!away || !quiet) continue;
      const { data: u } = await admin.auth.admin.getUserById(o.profile_id);
      if (!u?.user?.email) continue;
      const { data: conv } = await admin.from('conversations').select('status').eq('id', conversationId).maybeSingle();
      const name = session.profile?.full_name ?? 'A member';
      const isRequest = conv?.status === 'request';
      const { sendEmail, SITE } = await import('@/lib/email');
      await sendEmail(u.user.email, { subject: isRequest ? `${name} sent you a message request` : `New message from ${name}`, preheader: 'Open LanceNest to read and reply.', tone: 'notice', badge: isRequest ? 'Message request' : 'Message',
        heading: isRequest ? `${name} would like to connect.` : `${name} sent you a message.`, paragraphs: ['For your privacy, messages are only shown on LanceNest.'],
        cta: { label: isRequest ? 'Review the request' : 'Read and reply', url: `${SITE}/messages/${conversationId}` } });
      await admin.from('conversation_participants').update({ last_emailed_at: new Date().toISOString() }).eq('conversation_id', conversationId).eq('profile_id', o.profile_id);
    }
  } catch (err) { console.error('message email failed:', err); }
  redirect(`/messages/${conversationId}?error=${reason}`);
  }
  revalidatePath('/', 'layout');
}

/** Recipient accepts or declines a message request. */
export async function respondToRequest(conversationId: string, decision: 'active' | 'declined') {
  const session = await getSessionProfile();
  if (!session) redirect('/login?next=/messages');
  const admin = createAdminClient();
  const { data: c } = await admin.from('conversations').select('status, requested_by').eq('id', conversationId).maybeSingle();
  const { count } = await admin.from('conversation_participants').select('profile_id', { count: 'exact', head: true }).eq('conversation_id', conversationId).eq('profile_id', session.user.id);
  if (!c || !count || c.requested_by === session.user.id || c.status !== 'request') redirect('/messages');
  await admin.from('conversations').update({ status: decision }).eq('id', conversationId);
  redirect(decision === 'active' ? `/messages/${conversationId}` : '/messages?tab=requests');
}
