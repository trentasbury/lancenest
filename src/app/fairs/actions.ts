'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin, requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function registerFair(fairId: string, slug: string) {
  const { user } = await requireVerifiedMember(`/fairs/${slug}`);
  await createClient().from('fair_registrations').insert({ fair_id: fairId, profile_id: user.id });
  revalidatePath(`/fairs/${slug}`);
}
export async function leaveFair(fairId: string, slug: string) {
  const { user } = await requireVerifiedMember(`/fairs/${slug}`);
  await createClient().from('fair_registrations').delete().eq('fair_id', fairId).eq('profile_id', user.id);
  revalidatePath(`/fairs/${slug}`);
}
export async function updateBooth(boothId: string, slug: string, formData: FormData) {
  await requireVerifiedMember(`/fairs/${slug}`);
  const video = String(formData.get('video_url') ?? '').trim().slice(0, 300);
  await createClient().from('fair_booths').update({ pitch: String(formData.get('pitch') ?? '').trim().slice(0, 1000) || null, video_url: /^https:\/\//i.test(video) ? video : null }).eq('id', boothId);
  revalidatePath(`/fairs/${slug}`);
  redirect(`/fairs/${slug}?saved=1`);
}
/** Admin: schedule a fair. */
export async function createFair(formData: FormData) {
  await requireAdmin('/admin/fairs');
  const title = String(formData.get('title') ?? '').trim().slice(0, 140);
  const start = new Date(String(formData.get('starts_at') ?? ''));
  const hours = Math.min(12, Math.max(1, Number(formData.get('hours')) || 4));
  if (title.length < 4 || Number.isNaN(start.getTime())) redirect('/admin/fairs?error=1');
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}-${start.getFullYear()}${String(start.getMonth() + 1).padStart(2, '0')}`;
  await createAdminClient().from('career_fairs').insert({ slug, title, description: String(formData.get('description') ?? '').trim().slice(0, 4000) || null, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + hours * 3600000).toISOString() });
  revalidatePath('/fairs'); revalidatePath('/admin/fairs');
  redirect('/admin/fairs?created=1');
}
