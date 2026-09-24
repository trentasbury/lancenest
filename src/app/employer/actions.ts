'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/format';
import type { FormState } from '@/app/auth/actions';

export async function createCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireRole(['employer']);
  const supabase = createClient();

  const { data: existing } = await supabase.from('companies').select('id').eq('owner_id', user.id).maybeSingle();
  if (existing) return { error: 'Your account already has a company profile.' };

  const name = String(formData.get('name') ?? '').trim();
  const website = String(formData.get('website') ?? '').trim();
  if (!name) return { error: 'Enter your company name.' };
  if (website && !/^https?:\/\//i.test(website)) return { error: 'Website should start with https://' };

  const base = slugify(name) || 'company';
  const { data: taken } = await supabase.from('companies').select('id').eq('slug', base).maybeSingle();
  const slug = taken ? `${base}-${Math.random().toString(36).slice(2, 6)}` : base;

  const { error } = await supabase.from('companies').insert({
    owner_id: user.id,
    name,
    slug,
    industry: String(formData.get('industry') ?? '').trim() || null,
    headquarters: String(formData.get('headquarters') ?? '').trim() || null,
    website: website || null,
    about: String(formData.get('about') ?? '').trim() || null,
    veteran_commitment: String(formData.get('veteran_commitment') ?? '').trim() || null,
  });

  if (error) {
    console.error('createCompany failed:', error.message);
    return { error: 'We couldn’t save your company profile. Please try again.' };
  }

  revalidatePath('/employer/dashboard');
  redirect('/employer/dashboard');
}
