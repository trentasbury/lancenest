'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { MENTOR_FIELDS } from '@/lib/mentors';

export async function saveMentorProfile(formData: FormData) {
  const { user, profile } = await requireVerifiedMember('/mentors');
  if (!['veteran', 'admin'].includes(profile.role)) redirect('/mentors');
  const fields = formData.getAll('fields').map(String).filter((f) => MENTOR_FIELDS.includes(f)).slice(0, 6);
  const { error } = await createClient().from('mentor_profiles').upsert({
    profile_id: user.id, fields, bio: String(formData.get('bio') ?? '').trim().slice(0, 1000) || null, available: formData.get('available') === 'on', updated_at: new Date().toISOString(),
  });
  revalidatePath('/mentors');
  redirect(`/mentors?${error ? 'error=1' : 'saved=1'}`);
}
