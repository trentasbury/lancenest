'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/** Schedules one sponsored, verified employer for a Tuesday issue. */
export async function scheduleSponsor(formData: FormData) {
  const { user } = await requireAdmin('/admin/newsletter');
  const date = String(formData.get('issue_date') ?? '');
  const slug = String(formData.get('company') ?? '').trim().toLowerCase();
  const headline = String(formData.get('headline') ?? '').trim().slice(0, 90);
  const body = String(formData.get('body') ?? '').trim().slice(0, 300);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T12:00:00Z`).getUTCDay() !== 2) redirect('/admin/newsletter?error=date');
  if (headline.length < 4 || body.length < 10 || /https?:|www\.|@/.test(`${headline} ${body}`)) redirect('/admin/newsletter?error=text');
  const admin = createAdminClient();
  const { data: co } = await admin.from('companies').select('id, is_verified').eq('slug', slug).maybeSingle();
  if (!co?.is_verified) redirect('/admin/newsletter?error=company');
  const { error } = await admin.from('newsletter_sponsors').insert({ issue_date: date, company_id: co.id, headline, body, created_by: user.id });
  if (error) redirect(`/admin/newsletter?error=${error.code === '23505' ? 'taken' : 'text'}`);
  revalidatePath('/admin/newsletter');
  redirect('/admin/newsletter?saved=1');
}

export async function removeSponsor(id: string) {
  await requireAdmin('/admin/newsletter');
  await createAdminClient().from('newsletter_sponsors').delete().eq('id', id);
  revalidatePath('/admin/newsletter');
}
