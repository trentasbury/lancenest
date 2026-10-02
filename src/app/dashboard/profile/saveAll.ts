'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { BRANCHES, CLEARANCES, CLEARANCE_STATUS, COMPONENTS, POLYGRAPH, yearToDate } from '@/lib/military';
import { ensureOccupationsLoaded } from '@/lib/occupations';

type Svc = { id?: string; branch: string; component: string; rank: string; duty_title: string; unit: string; occupation_code: string; start_year: string; end_year: string; description: string; deployments: string };
type Exp = { id?: string; company: string; position: string; start_year: string; end_year: string; description: string };
type Edu = { id?: string; school: string; degree: string; field: string; graduation_year: string };
export type ProfilePayload = {
  basics: { full_name: string; headline: string; city: string; state: string; about: string; clearance_level: string; clearance_status: string; polygraph: string; willing_to_relocate: boolean; is_public: boolean; desired_titles: string };
  service: Svc[]; experience: Exp[]; education: Edu[]; skills: string[];
};
const s = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

/** One Save for the whole profile: updates existing entries, adds new ones, removes deleted ones. */
export async function saveFullProfile(p: ProfilePayload): Promise<{ ok: boolean; error?: string }> {
  const { user } = await requireRole(['veteran', 'admin'], '/dashboard/profile');
  const supabase = createClient();
  const b = p.basics;
  const fullName = s(b.full_name, 120);
  if (!fullName) return { ok: false, error: 'Please enter your full name.' };
  const city = s(b.city, 80), state = s(b.state, 40);
  const { error: e1 } = await supabase.from('profiles').update({ full_name: fullName, headline: s(b.headline, 140) || null, location: [city, state].filter(Boolean).join(', ') || null, onboarding_completed: true }).eq('id', user.id);
  const { error: e2 } = await supabase.from('veteran_profiles').update({
    about: s(b.about, 3000) || null, city: city || null, state: state || null,
    clearance_level: CLEARANCES.some(([v]) => v === b.clearance_level) ? b.clearance_level : 'none',
    clearance_status: b.clearance_level !== 'none' && CLEARANCE_STATUS.some(([v]) => v === b.clearance_status) ? b.clearance_status : null,
    polygraph: b.clearance_level !== 'none' && POLYGRAPH.some(([v]) => v === b.polygraph) ? b.polygraph : 'none',
    willing_to_relocate: !!b.willing_to_relocate, is_public: !!b.is_public,
    desired_titles: s(b.desired_titles, 400).split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8),
  }).eq('profile_id', user.id);
  if (e1 || e2) return { ok: false, error: 'Your basics didn’t save — please try again.' };

  // Military service (multiple branches and duty stations)
  if (p.service.some((x) => x.occupation_code)) await ensureOccupationsLoaded();
  const keepSvc: string[] = [];
  for (const x of p.service.slice(0, 20)) {
    const branch = s(x.branch, 20);
    if (!BRANCHES.includes(branch as (typeof BRANCHES)[number])) return { ok: false, error: 'Choose a branch for each military entry.' };
    const code = s(x.occupation_code, 12).toUpperCase();
    const { data: occ } = code ? await supabase.from('military_occupations').select('id').ilike('code', code.replace(/[%_\\]/g, '')).eq('branch', branch).maybeSingle() : { data: null };
    const startY = Number(x.start_year), endY = Number(x.end_year);
    if (x.start_year && x.end_year && endY < startY) return { ok: false, error: `${branch}: the end year is before the start year.` };
    const row = { profile_id: user.id, branch, component: COMPONENTS.some(([v]) => v === x.component) ? x.component : 'active', rank: s(x.rank, 30) || null,
      duty_title: s(x.duty_title, 120) || null, unit: s(x.unit, 120) || null, description: s(x.description, 2000) || null, occupation_code: code || null,
      occupation_id: occ?.id ?? null, start_date: yearToDate(x.start_year), end_date: yearToDate(x.end_year), deployments: Math.max(0, Math.min(50, Number(x.deployments) || 0)) };
    const res = x.id ? await supabase.from('military_service').update(row).eq('id', x.id).eq('profile_id', user.id).select('id').single()
                     : await supabase.from('military_service').insert(row).select('id').single();
    if (res.error) { console.error('service save failed:', res.error.message); return { ok: false, error: `Couldn’t save your ${branch} entry — check the years and try again.` }; }
    keepSvc.push(res.data.id as string);
  }
  await removeOthers(supabase, 'military_service', user.id, keepSvc);

  // Professional career
  const keepExp: string[] = [];
  for (const x of p.experience.slice(0, 30)) {
    const company = s(x.company, 120), position = s(x.position, 120);
    if (!company && !position) continue;
    if (!company || !position) return { ok: false, error: 'Each job needs a company and a title.' };
    const row = { profile_id: user.id, company, position, start_date: yearToDate(x.start_year), end_date: yearToDate(x.end_year), description: s(x.description, 2000) || null };
    const res = x.id ? await supabase.from('experience').update(row).eq('id', x.id).eq('profile_id', user.id).select('id').single()
                     : await supabase.from('experience').insert(row).select('id').single();
    if (res.error) return { ok: false, error: `Couldn’t save “${position}” — check the years and try again.` };
    keepExp.push(res.data.id as string);
  }
  await removeOthers(supabase, 'experience', user.id, keepExp);

  // Education
  const keepEdu: string[] = [];
  for (const x of p.education.slice(0, 15)) {
    const school = s(x.school, 160);
    if (!school) continue;
    const year = Number(x.graduation_year);
    const row = { profile_id: user.id, school, degree: s(x.degree, 120) || null, field: s(x.field, 120) || null, graduation_year: Number.isInteger(year) && year >= 1950 && year <= 2100 ? year : null };
    const res = x.id ? await supabase.from('education').update(row).eq('id', x.id).eq('profile_id', user.id).select('id').single()
                     : await supabase.from('education').insert(row).select('id').single();
    if (res.error) return { ok: false, error: `Couldn’t save ${school}.` };
    keepEdu.push(res.data.id as string);
  }
  await removeOthers(supabase, 'education', user.id, keepEdu);

  // Skills (by name; new names are added to the shared skills list)
  const names = Array.from(new Set(p.skills.map((n) => s(n, 60).replace(/[%_\\]/g, '')).filter(Boolean))).slice(0, 50);
  const skillIds: string[] = [];
  for (const name of names) {
    let { data: skill } = await supabase.from('skills').select('id').ilike('name', name).maybeSingle();
    if (!skill) { await supabase.from('skills').insert({ name, category: 'civilian' }); ({ data: skill } = await supabase.from('skills').select('id').ilike('name', name).maybeSingle()); }
    if (skill) skillIds.push(skill.id as string);
  }
  const { data: current } = await supabase.from('profile_skills').select('skill_id').eq('profile_id', user.id);
  const drop = (current ?? []).map((r) => r.skill_id as string).filter((id) => !skillIds.includes(id));
  if (drop.length) await supabase.from('profile_skills').delete().eq('profile_id', user.id).in('skill_id', drop);
  if (skillIds.length) await supabase.from('profile_skills').upsert(skillIds.map((id) => ({ profile_id: user.id, skill_id: id })), { ignoreDuplicates: true });

  revalidatePath('/dashboard/profile'); revalidatePath('/dashboard');
  return { ok: true };
}

async function removeOthers(supabase: ReturnType<typeof createClient>, table: 'military_service' | 'experience' | 'education', userId: string, keep: string[]) {
  let q = supabase.from(table).delete().eq('profile_id', userId);
  if (keep.length) q = q.not('id', 'in', `(${keep.join(',')})`);
  await q;
}
