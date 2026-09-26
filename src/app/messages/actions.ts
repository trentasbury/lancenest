'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CONTACTS_PER_MONTH, monthStart, type Plan } from '@/lib/employer';

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

  // Employers contacting a veteran first: free if the veteran applied to them or was already
  // contacted; otherwise it uses the plan's monthly allowance, then a purchased credit.
  const [{ data: meP }, { data: otherP }] = await Promise.all([
    admin.from('profiles').select('role').eq('id', me).maybeSingle(),
    admin.from('profiles').select('role').eq('id', otherId).maybeSingle(),
  ]);
  if (meP?.role === 'employer' && otherP?.role === 'veteran') {
    const { data: company } = await admin.from('companies').select('id, plan, contact_credits').eq('owner_id', me).maybeSingle();
    if (!company) redirect('/employer/dashboard');
    const [{ count: applied }, { count: contacted }] = await Promise.all([
      admin.from('applications').select('id, jobs!inner(company_id)', { count: 'exact', head: true }).eq('profile_id', otherId).eq('jobs.company_id', company.id),
      admin.from('employer_contacts').select('veteran_id', { count: 'exact', head: true }).eq('company_id', company.id).eq('veteran_id', otherId),
    ]);
    if (!applied && !contacted) {
      const limit = CONTACTS_PER_MONTH[company.plan as Plan] ?? 0;
      const { count: used } = await admin.from('employer_contacts').select('*', { count: 'exact', head: true })
        .eq('company_id', company.id).eq('source', 'allowance').gte('created_at', monthStart());
      if ((used ?? 0) < limit) {
        await admin.from('employer_contacts').insert({ company_id: company.id, veteran_id: otherId, source: 'allowance' });
      } else {
        const { data: spent } = await admin.from('companies').update({ contact_credits: (company.contact_credits as number) - 1 })
          .eq('id', company.id).gt('contact_credits', 0).eq('contact_credits', company.contact_credits).select('id');
        if (!spent?.length) redirect('/messages?error=credits');
        await admin.from('employer_contacts').insert({ company_id: company.id, veteran_id: otherId, source: 'credit' });
      }
    }
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
  if (error) {
    const reason = error.code === 'P0002' ? 'rate' : error.message.includes("can't") ? 'blocked' : 'send';
    redirect(`/messages/${conversationId}?error=${reason}`);
  }
  revalidatePath('/', 'layout');
}
