'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ID_TYPES } from './idTypes';

const PAGE = '/dashboard/verification';
const BUCKET = 'verification-docs';

/**
 * Files are uploaded straight from the browser into the member's own private folder
 * (the bucket enforces 4 MB and PDF/JPG/PNG; storage rules only allow their own folder).
 * This action checks both files are really theirs and opens the review request.
 */
export async function submitVerification(formData: FormData) {
  const { user } = await requireRole(['veteran'], PAGE);
  const docPath = String(formData.get('document_path') ?? '');
  const idPath = String(formData.get('id_document_path') ?? '');
  const docType = String(formData.get('doc_type') ?? '').slice(0, 40);
  const idType = String(formData.get('id_type') ?? '');
  const memberNote = String(formData.get('member_note') ?? '').trim().slice(0, 300) || null;

  const supabase = createClient();
  const cleanup = async () => { await supabase.storage.from(BUCKET).remove([docPath, idPath].filter((p) => p.startsWith(`${user.id}/`))); };
  const fail = async (code: string) => { await cleanup(); redirect(`${PAGE}?error=${code}`); };

  const own = (p: string, kind: 'service' | 'photo-id') => new RegExp(`^${user.id}/\\d+-${kind}\\.(pdf|jpg|png)$`).test(p);
  if (!own(docPath, 'service')) await fail('missing');
  if (!own(idPath, 'photo-id')) await fail('id_missing');
  if (!Object.prototype.hasOwnProperty.call(ID_TYPES, idType)) await fail('id_type');
  if (formData.get('redacted') !== 'on') await fail('redact');
  if (formData.get('id_consent') !== 'on') await fail('consent');

  // Both uploads must actually exist in the member's folder.
  const { data: files } = await supabase.storage.from(BUCKET).list(user.id, { limit: 100 });
  const names = new Set((files ?? []).map((f) => `${user.id}/${f.name}`));
  if (!names.has(docPath) || !names.has(idPath)) await fail('upload');

  const { error } = await supabase.from('verification_requests').insert({
    profile_id: user.id, document_path: docPath, id_document_path: idPath, id_type: idType, notes: docType || null, member_note: memberNote,
  });
  if (error) {
    console.error('verification request failed:', error.message);
    await fail(error.code === '23505' ? 'pending' : 'upload');
  }

  revalidatePath(PAGE);
  revalidatePath('/dashboard');
  try {
    const { notifyMember } = await import('@/lib/email');
    await notifyMember(user.id, { type: 'verification', link: '/dashboard/verification', title: 'We received your verification documents. Most reviews are finished within 48 hours.',
      email: { subject: 'We received your verification documents', preheader: 'Most reviews are finished within 48 hours.', tone: 'notice', badge: 'Verification',
        heading: 'Your documents are in review.', paragraphs: ['Thank you for verifying your service. A LanceNest reviewer will check your service document against your photo ID — most reviews are finished within 48 hours.', 'Both files are deleted as soon as the review is complete. We’ll email you the moment you’re verified.'] } });
  } catch (err) { console.error('verification receipt failed:', err); }
  redirect(`${PAGE}?submitted=1`);
}
