'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const PAGE = '/dashboard/verification';
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

export async function submitVerification(formData: FormData) {
  const { user } = await requireRole(['veteran'], PAGE);
  const file = formData.get('document');
  const docType = String(formData.get('doc_type') ?? '').slice(0, 40);
  const confirmedRedaction = formData.get('redacted') === 'on';

  if (!(file instanceof File) || file.size === 0) redirect(`${PAGE}?error=missing`);
  if (!confirmedRedaction) redirect(`${PAGE}?error=redact`);
  if (file.size > MAX_BYTES) redirect(`${PAGE}?error=size`);
  const ext = TYPES[file.type];
  if (!ext) redirect(`${PAGE}?error=type`);

  const supabase = createClient();
  // Private bucket; storage rules only allow writing inside the uploader's own folder.
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from('verification-docs').upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    console.error('verification upload failed:', uploadError.message);
    redirect(`${PAGE}?error=upload`);
  }

  const { error } = await supabase.from('verification_requests').insert({ profile_id: user.id, document_path: path, notes: docType || null });
  if (error) {
    await supabase.storage.from('verification-docs').remove([path]);
    console.error('verification request failed:', error.message);
    redirect(`${PAGE}?error=${error.code === '23505' ? 'pending' : 'upload'}`);
  }

  revalidatePath(PAGE);
  revalidatePath('/dashboard');
  redirect(`${PAGE}?submitted=1`);
}
