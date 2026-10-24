'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyMember } from '@/lib/email';

export async function decideCredential(id: string, decision: 'verified' | 'rejected', formData: FormData) {
  const { user } = await requireAdmin('/admin/credentials');
  const admin = createAdminClient();
  const note = String(formData.get('note') ?? '').trim().slice(0, 300) || null;
  const { data: c } = await admin.from('credentials').select('id, profile_id, name, kind, document_path, status').eq('id', id).maybeSingle();
  if (!c || c.status !== 'pending') return;
  // The file is only needed for the review.
  await admin.from('credentials').update({ status: decision, note, reviewer_id: user.id, reviewed_at: new Date().toISOString(), document_path: null }).eq('id', id);
  if (c.document_path) await admin.storage.from('verification-docs').remove([c.document_path as string]);
  await admin.from('admin_actions').insert({ admin_id: user.id, action: decision === 'verified' ? 'credential_approved' : 'credential_rejected', target_type: 'profile', target_id: c.profile_id, details: { credential: c.name, ...(note ? { note } : {}) } });
  await notifyMember(c.profile_id as string, { type: 'verification', link: '/dashboard/credentials',
    title: decision === 'verified' ? `✓ Your ${c.kind} “${c.name}” is verified and now shows on your profile.` : `We couldn’t verify “${c.name}”${note ? `: ${note}` : '.'} You can send it again.` });
  revalidatePath('/admin/credentials');
}
