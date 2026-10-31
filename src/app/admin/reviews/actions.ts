'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/** Approve a held review: it shows on the member's profile and counts toward their rating. */
export async function approveReview(reviewId: string) {
  const { user } = await requireAdmin('/admin/reviews');
  const admin = createAdminClient();
  await admin.from('reviews').update({ held: false }).eq('id', reviewId).eq('held', true);
  await admin.from('admin_actions').insert({ admin_id: user.id, action: 'review_approved', target_type: 'review', target_id: reviewId, details: {} });
  revalidatePath('/admin/reviews');
}

/** Remove a held review that looks bought or fake (for example, the client and freelancer are the same person). */
export async function removeReview(reviewId: string) {
  const { user } = await requireAdmin('/admin/reviews');
  const admin = createAdminClient();
  const { data: r } = await admin.from('reviews').select('reviewer_id, reviewee_id, rating, body').eq('id', reviewId).eq('held', true).maybeSingle();
  if (!r) return;
  await admin.from('reviews').delete().eq('id', reviewId).eq('held', true);
  await admin.from('admin_actions').insert({ admin_id: user.id, action: 'review_removed', target_type: 'review', target_id: reviewId, details: r });
  revalidatePath('/admin/reviews');
}
