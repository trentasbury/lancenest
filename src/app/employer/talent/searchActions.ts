'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getMyCompany } from '@/lib/employer';

const KEYS = ['q', 'branch', 'mos', 'state', 'skill', 'clearance', 'verified', 'relocate', 'transitioning'];

export async function saveSearch(formData: FormData) {
  const { user } = await requireRole(['employer'], '/employer/candidates');
  const company = await getMyCompany(user.id);
  if (!company) redirect('/employer/dashboard');
  let raw: Record<string, unknown> = {};
  try { raw = JSON.parse(String(formData.get('params') ?? '{}')); } catch { raw = {}; }
  const params = Object.fromEntries(KEYS.filter((k) => typeof raw[k] === 'string' && raw[k]).map((k) => [k, String(raw[k]).slice(0, 80)]));
  const { error } = await createClient().from('saved_searches').insert({ company_id: company.id, created_by: user.id, name: String(formData.get('name') ?? '').trim().slice(0, 80) || 'Saved search', params });
  revalidatePath('/employer/candidates');
  redirect(`/employer/candidates?${new URLSearchParams(params as Record<string, string>)}${error ? '&saved=limit' : '&saved=1'}`);
}

export async function deleteSavedSearch(id: string) {
  const { user } = await requireRole(['employer'], '/employer/candidates');
  const company = await getMyCompany(user.id);
  if (!company) return;
  await createClient().from('saved_searches').delete().eq('id', id).eq('company_id', company.id);
  revalidatePath('/employer/candidates');
}
