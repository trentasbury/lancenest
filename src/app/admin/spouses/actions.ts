'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyMember } from '@/lib/email';

/** Admin: mark a surviving spouse (never expires), or give another year after checking documents by other means. */
export async function adminSpouseLink(spouseId: string, change: 'surviving' | 'extend') {
  const { user } = await requireAdmin('/admin/spouses');
  const admin = createAdminClient();
  const update = change === 'surviving'
    ? { surviving: true, grace_until: null, reminded_at: null }
    : { confirmed_until: new Date(Date.now() + 365 * 86400000).toISOString(), grace_until: null, reminded_at: null };
  const { data } = await admin.from('spouse_links').update(update).eq('spouse_id', spouseId).select('spouse_id').maybeSingle();
  if (!data) return;
  await admin.from('admin_actions').insert({ admin_id: user.id, action: change === 'surviving' ? 'spouse_marked_surviving' : 'spouse_extended', target_type: 'profile', target_id: spouseId, details: {} });
  await notifyMember(spouseId, { type: 'verification', link: '/dashboard', title: change === 'surviving'
    ? 'Your military spouse status is permanent. Thank you, and we’re honored to have you on LanceNest.'
    : 'Your military spouse status is renewed for another year.' });
  revalidatePath('/admin/spouses');
}
