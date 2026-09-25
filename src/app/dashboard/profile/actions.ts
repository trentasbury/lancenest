'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { BRANCHES, CLEARANCES, COMPONENTS, yearToDate } from '@/lib/military';

const PAGE = '/dashboard/profile';

function text(formData: FormData, name: string, max = 200) {
  return String(formData.get(name) ?? '').trim().slice(0, max);
}

function done(section: string, error?: string, share?: string): never {
  revalidatePath(PAGE);
  revalidatePath('/dashboard');
  const q = error ? `error=${error}` : `saved=${section}${share ? `&share=${share}` : ''}`;
  redirect(`${PAGE}?${q}#${share ? 'share' : section}`);
}

export async function saveBasics(formData: FormData) {
  const { user } = await requireRole(['veteran'], PAGE);
  const supabase = createClient();

  const fullName = text(formData, 'full_name', 120);
  if (!fullName) done('basics', 'name');
  const city = text(formData, 'city', 80);
  const state = text(formData, 'state', 40);
  const clearance = text(formData, 'clearance_level', 20);

  const { error: e1 } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      headline: text(formData, 'headline', 140) || null,
      location: [city, state].filter(Boolean).join(', ') || null,
      onboarding_completed: true,
    })
    .eq('id', user.id);

  const { error: e2 } = await supabase
    .from('veteran_profiles')
    .update({
      about: text(formData, 'about', 3000) || null,
      city: city || null,
      state: state || null,
      clearance_level: CLEARANCES.some(([v]) => v === clearance) ? clearance : 'none',
      willing_to_relocate: formData.get('willing_to_relocate') === 'on',
      is_public: formData.get('is_public') === 'on',
    })
    .eq('profile_id', user.id);

  if (e1 || e2) {
    console.error('saveBasics failed:', e1?.message ?? e2?.message);
    done('basics', 'save');
  }
  done('basics');
}

export async function addSkill(formData: FormData) {
  const { user } = await requireRole(['veteran'], PAGE);
  const supabase = createClient();
  const name = text(formData, 'skill', 60).replace(/[%_\\]/g, '');
  if (!name) done('skills', 'skill');

  let { data: skill } = await supabase.from('skills').select('id').ilike('name', name).maybeSingle();
  if (!skill) {
    const inserted = await supabase.from('skills').insert({ name, category: 'civilian' }).select('id').single();
    skill = inserted.data;
    if (!skill) {
      // Someone added the same skill at the same moment — fetch theirs.
      ({ data: skill } = await supabase.from('skills').select('id').ilike('name', name).maybeSingle());
    }
  }
  if (!skill) done('skills', 'save');

  await supabase.from('profile_skills').upsert({ profile_id: user.id, skill_id: skill.id }, { ignoreDuplicates: true });
  done('skills');
}

export async function removeSkill(skillId: string) {
  const { user } = await requireRole(['veteran'], PAGE);
  const supabase = createClient();
  await supabase.from('profile_skills').delete().eq('profile_id', user.id).eq('skill_id', skillId);
  done('skills');
}

export async function addService(formData: FormData) {
  const { user } = await requireRole(['veteran'], PAGE);
  const supabase = createClient();

  const branch = text(formData, 'branch', 20);
  const component = text(formData, 'component', 10);
  if (!BRANCHES.includes(branch as (typeof BRANCHES)[number])) done('service', 'branch');
  const code = text(formData, 'occupation_code', 12).toUpperCase();

  let occupationId: string | null = null;
  if (code) {
    const { data } = await supabase
      .from('military_occupations')
      .select('id')
      .ilike('code', code.replace(/[%_\\]/g, ''))
      .eq('branch', branch)
      .maybeSingle();
    occupationId = data?.id ?? null;
  }

  const deployments = Math.max(0, Math.min(50, Number(formData.get('deployments')) || 0));
  const { data: row, error } = await supabase.from('military_service').insert({
    profile_id: user.id,
    branch,
    component: COMPONENTS.some(([v]) => v === component) ? component : 'active',
    rank: text(formData, 'rank', 30) || null,
    occupation_code: code || null,
    occupation_id: occupationId,
    start_date: yearToDate(formData.get('start_year')),
    end_date: yearToDate(formData.get('end_year')),
    deployments,
  }).select('id, end_date').single();
  if (error) {
    console.error('addService failed:', error.message);
    done('service', error.message.includes('check') ? 'years' : 'save');
  }
  done('service', undefined, row?.end_date ? `service:${row.id}` : undefined);
}

export async function removeService(id: string) {
  const { user } = await requireRole(['veteran'], PAGE);
  const supabase = createClient();
  await supabase.from('military_service').delete().eq('id', id).eq('profile_id', user.id);
  done('service');
}

export async function addExperience(formData: FormData) {
  const { user } = await requireRole(['veteran'], PAGE);
  const supabase = createClient();
  const company = text(formData, 'company', 120);
  const position = text(formData, 'position', 120);
  if (!company || !position) done('experience', 'experience');

  const { data: row, error } = await supabase.from('experience').insert({
    profile_id: user.id,
    company,
    position,
    start_date: yearToDate(formData.get('start_year')),
    end_date: yearToDate(formData.get('end_year')),
    description: text(formData, 'description', 2000) || null,
  }).select('id').single();
  if (error) {
    console.error('addExperience failed:', error.message);
    done('experience', 'save');
  }
  done('experience', undefined, row ? `experience:${row.id}` : undefined);
}

export async function removeExperience(id: string) {
  const { user } = await requireRole(['veteran'], PAGE);
  const supabase = createClient();
  await supabase.from('experience').delete().eq('id', id).eq('profile_id', user.id);
  done('experience');
}

export async function addEducation(formData: FormData) {
  const { user } = await requireRole(['veteran'], PAGE);
  const supabase = createClient();
  const school = text(formData, 'school', 160);
  if (!school) done('education', 'school');
  const year = Number(formData.get('graduation_year'));

  const { data: row, error } = await supabase.from('education').insert({
    profile_id: user.id,
    school,
    degree: text(formData, 'degree', 120) || null,
    field: text(formData, 'field', 120) || null,
    graduation_year: Number.isInteger(year) && year >= 1950 && year <= 2100 ? year : null,
  }).select('id').single();
  if (error) {
    console.error('addEducation failed:', error.message);
    done('education', 'save');
  }
  done('education', undefined, row ? `education:${row.id}` : undefined);
}

export async function removeEducation(id: string) {
  const { user } = await requireRole(['veteran'], PAGE);
  const supabase = createClient();
  await supabase.from('education').delete().eq('id', id).eq('profile_id', user.id);
  done('education');
}
