'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin, requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validTimezone, zonedTimeToUtc } from '@/lib/fairs';
import { baseBySlug } from '@/lib/bases';
import { stateOf } from '@/lib/place';

export async function registerFair(fairId: string, slug: string) {
  const { user } = await requireVerifiedMember(`/fairs/${slug}`);
  const { error } = await (await createClient()).from('fair_registrations').insert({ fair_id: fairId, profile_id: user.id });
  if (error?.code === 'P0029') redirect(`/fairs/${slug}?full=1`);
  revalidatePath(`/fairs/${slug}`);
}
export async function leaveFair(fairId: string, slug: string) {
  const { user } = await requireVerifiedMember(`/fairs/${slug}`);
  await (await createClient()).from('fair_registrations').delete().eq('fair_id', fairId).eq('profile_id', user.id);
  revalidatePath(`/fairs/${slug}`);
}
export async function updateBooth(boothId: string, slug: string, formData: FormData) {
  await requireVerifiedMember(`/fairs/${slug}`);
  const video = String(formData.get('video_url') ?? '').trim().slice(0, 300);
  await (await createClient()).from('fair_booths').update({ pitch: String(formData.get('pitch') ?? '').trim().slice(0, 1000) || null, video_url: /^https:\/\//i.test(video) ? video : null }).eq('id', boothId);
  revalidatePath(`/fairs/${slug}`);
  redirect(`/fairs/${slug}?saved=1`);
}
/** Admin: schedule a fair, virtual or in person (a pop-up), with times in the fair's own time zone. */
export async function createFair(formData: FormData) {
  await requireAdmin('/admin/fairs');
  const t = (k: string, max: number) => String(formData.get(k) ?? '').trim().slice(0, max);
  const title = t('title', 140);
  const format = (['virtual', 'in_person', 'hybrid'] as const).find((f) => f === formData.get('format')) ?? 'virtual';
  const timezone = validTimezone(t('timezone', 60));
  const start = zonedTimeToUtc(t('starts_at', 20), timezone);
  const hours = Math.min(12, Math.max(1, Number(formData.get('hours')) || 4));
  if (title.length < 4 || !start || Number.isNaN(start.getTime())) redirect('/admin/fairs?error=1');
  const inPerson = format !== 'virtual';
  const city = t('city', 80), state = t('state', 2).toUpperCase();
  if (inPerson && (!city || !stateOf(state))) redirect('/admin/fairs?error=place');
  const baseSlug = t('base_slug', 80);
  const capacity = Math.round(Number(formData.get('capacity')));
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}-${start!.getFullYear()}${String(start!.getMonth() + 1).padStart(2, '0')}`;
  const { error } = await createAdminClient().from('career_fairs').insert({
    slug, title, description: t('description', 4000) || null, starts_at: start!.toISOString(), ends_at: new Date(start!.getTime() + hours * 3600000).toISOString(),
    format, timezone,
    venue_name: inPerson ? t('venue_name', 140) || null : null, address: inPerson ? t('address', 240) || null : null,
    city: inPerson ? city : null, state: inPerson ? state : null,
    base_slug: baseBySlug(baseSlug) ? baseSlug : null,
    capacity: inPerson && capacity >= 1 && capacity <= 100000 ? capacity : null,
  });
  if (error) redirect(`/admin/fairs?error=${error.code === '23505' ? 'slug' : '1'}`);
  revalidatePath('/fairs'); revalidatePath('/admin/fairs'); revalidatePath('/bases/[slug]', 'page');
  redirect('/admin/fairs?created=1');
}
