'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyMember } from '@/lib/email';

/** Admin: approve or decline a member's group request, or close / reopen a member group. */
export async function reviewGroup(groupId: string, decision: 'approve' | 'reject' | 'archive' | 'reopen', formData?: FormData) {
  const { user } = await requireAdmin('/admin/groups');
  const admin = createAdminClient();
  const note = String(formData?.get('note') ?? '').trim().slice(0, 500) || null;
  const { data: g } = await admin.from('groups').select('id, slug, name, created_by, status, kind').eq('id', groupId).maybeSingle();
  if (!g || g.kind) return;   // LanceNest's own groups aren't reviewed here

  const status = decision === 'approve' || decision === 'reopen' ? 'approved' : decision === 'reject' ? 'rejected' : 'archived';
  await admin.from('groups').update({ status, review_note: note, reviewed_at: new Date().toISOString() }).eq('id', groupId);

  if (status === 'approved' && g.created_by) {
    // The starter (or whoever it was handed to) is the owner.
    await admin.from('group_members').upsert({ group_id: groupId, profile_id: g.created_by, role: 'owner', status: 'active', request_note: null }, { onConflict: 'group_id,profile_id' });
  }
  if (status === 'approved' && g.created_by && g.status !== 'archived') {
    await notifyMember(g.created_by as string, {
      type: 'group_approved', link: `/groups/${g.slug}`,
      title: `Your group “${String(g.name).slice(0, 60)}” is live. Invite your people.`,
    });
  }
  if (decision === 'reject' && g.created_by) {
    await notifyMember(g.created_by as string, {
      type: 'group_rejected', link: '/groups',
      title: `Your group “${String(g.name).slice(0, 60)}” wasn’t approved.${note ? ' See the note on the Groups page.' : ''}`,
    });
  }
  await admin.from('admin_actions').insert({ admin_id: user.id, action: `group_${decision}`, target_type: 'group', target_id: groupId, details: note ? { note } : {} });
  revalidatePath('/admin/groups'); revalidatePath('/groups'); revalidatePath(`/groups/${g.slug}`);
}
