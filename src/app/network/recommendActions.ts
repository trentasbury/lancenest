'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { notifyMember } from '@/lib/email';

export async function writeRecommendation(subjectId: string, username: string, formData: FormData) {
  const { profile } = await requireVerifiedMember(`/veterans/${username}`);
  const relationship = String(formData.get('relationship') ?? '').trim().slice(0, 140);
  const body = String(formData.get('body') ?? '').trim().slice(0, 2000);
  if (relationship.length < 3 || body.length < 20) redirect(`/veterans/${username}?rec=short`);
  const { error } = await createClient().from('recommendations').insert({ author_id: profile.id, subject_id: subjectId, relationship, body });
  if (error) redirect(`/veterans/${username}?rec=${error.code === '23505' ? 'exists' : 'error'}`);
  await notifyMember(subjectId, { type: 'recommendation', link: `/veterans/${username}#recommendations`, title: `${profile.full_name} wrote you a recommendation. Review it to show it on your profile.` });
  redirect(`/veterans/${username}?rec=sent`);
}

export async function decideRecommendation(id: string, status: 'accepted' | 'hidden', username: string) {
  const { user } = await requireVerifiedMember(`/veterans/${username}`);
  await createClient().from('recommendations').update({ status }).eq('id', id).eq('subject_id', user.id);
  revalidatePath(`/veterans/${username}`);
}
