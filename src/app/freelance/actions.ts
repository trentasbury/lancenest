'use server';

import { getMyCompany } from '@/lib/employer';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CATEGORIES } from '@/lib/freelance';
import { scamSignals } from '@/lib/scam';

const t = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? '').trim().slice(0, max);
const money = (v: string) => { const n = Math.round(Number(v.replace(/[$,\s]/g, ''))); return Number.isFinite(n) && n > 0 ? n : null; };
const CLEARANCES = ['none', 'public_trust', 'confidential', 'secret', 'top_secret', 'ts_sci'];

export async function saveFreelancerProfile(formData: FormData) {
  const { user } = await requireRole(['veteran'], '/freelance/profile');
  const supabase = createClient();
  const title = t(formData, 'title', 120);
  if (title.length < 2) redirect('/freelance/profile?error=title');
  const rate = money(t(formData, 'hourly_rate', 6));
  const uei = t(formData, 'sam_uei', 12).toUpperCase();
  const fields = {
    title, bio: t(formData, 'bio', 3000) || null, hourly_rate: rate && rate >= 10 && rate <= 1000 ? rate : null,
    available: formData.get('available') === 'on', clearance_work: formData.get('clearance_work') === 'on',
    vosb: formData.get('vosb') === 'on', sdvosb: formData.get('sdvosb') === 'on', sam_uei: uei.length === 12 ? uei : null,
  };
  const { data: existing } = await supabase.from('freelancer_profiles').select('profile_id').eq('profile_id', user.id).maybeSingle();
  const { error } = existing
    ? await supabase.from('freelancer_profiles').update(fields).eq('profile_id', user.id)
    : await supabase.from('freelancer_profiles').insert({ profile_id: user.id, ...fields });
  if (error) { console.error('saveFreelancerProfile:', error.message); redirect('/freelance/profile?error=save'); }
  revalidatePath('/freelance', 'layout');
  redirect('/freelance/profile?saved=1');
}

export async function addPortfolioItem(formData: FormData) {
  const { user } = await requireRole(['veteran'], '/freelance/profile');
  const url = t(formData, 'url', 300);
  const { error } = await createClient().from('portfolio_items').insert({
    profile_id: user.id, title: t(formData, 'title', 120), description: t(formData, 'description', 1500) || null,
    url: url ? (/^https?:\/\//i.test(url) ? url : `https://${url}`) : null,
  });
  if (error) redirect('/freelance/profile?error=portfolio');
  revalidatePath('/freelance/profile');
  redirect('/freelance/profile?saved=1#portfolio');
}

export async function removePortfolioItem(id: string) {
  const { user } = await requireRole(['veteran'], '/freelance/profile');
  await createClient().from('portfolio_items').delete().eq('id', id).eq('profile_id', user.id);
  revalidatePath('/freelance/profile');
}

export async function createProject(formData: FormData) {
  const { user } = await requireRole(['employer'], '/freelance/projects/new');
  const supabase = createClient();
  const company = await getMyCompany(user.id);
  if (!company?.is_verified) redirect('/employer/dashboard?verify=required');
  const title = t(formData, 'title', 140);
  const description = t(formData, 'description', 8000);
  if (title.length < 4 || description.length < 20) redirect('/freelance/projects/new?error=required');
  if (scamSignals(`${title}\n${description}`, 'block').length) redirect('/freelance/projects/new?error=scam');
  const min = money(t(formData, 'budget_min', 9)); const max = money(t(formData, 'budget_max', 9));
  if (min && max && max < min) redirect('/freelance/projects/new?error=budget');
  const category = t(formData, 'category', 60);
  const clearance = t(formData, 'clearance_required', 14);
  const { data, error } = await supabase.from('freelance_projects').insert({
    client_id: user.id, company_id: company.id, title, description,
    category: CATEGORIES.includes(category) ? category : null,
    budget_type: t(formData, 'budget_type', 6) === 'hourly' ? 'hourly' : 'fixed', budget_min: min, budget_max: max,
    clearance_required: CLEARANCES.includes(clearance) ? clearance : 'none',
  }).select('id').single();
  if (error || !data) { console.error('createProject:', error?.message); redirect(`/freelance/projects/new?error=${error?.code === 'P0009' ? 'pii' : 'save'}`); }
  revalidatePath('/freelance');
  redirect(`/freelance/projects/${data.id}`);
}

export async function setProjectStatus(projectId: string, status: 'open' | 'closed') {
  const { user } = await requireRole(['employer'], '/freelance');
  await createClient().from('freelance_projects').update({ status }).eq('id', projectId).eq('client_id', user.id);
  revalidatePath(`/freelance/projects/${projectId}`);
}

export async function submitProposal(projectId: string, formData: FormData) {
  const { user } = await requireRole(['veteran'], `/freelance/projects/${projectId}`);
  const bid = money(t(formData, 'bid_amount', 9));
  const cover = t(formData, 'cover_letter', 5000);
  if (!bid || cover.length < 30) redirect(`/freelance/projects/${projectId}?error=proposal`);
  const { error } = await createClient().from('proposals').insert({
    project_id: projectId, freelancer_id: user.id, cover_letter: cover, bid_amount: bid, timeline: t(formData, 'timeline', 120) || null,
  });
  if (error) {
    const code = error.code === 'P0009' ? 'pii' : error.code === 'P0006' ? 'limit' : error.code === 'P0005' ? 'closed' : error.code === '23505' ? 'duplicate' : 'save';
    redirect(`/freelance/projects/${projectId}?error=${code}`);
  }
  revalidatePath(`/freelance/projects/${projectId}`);
  redirect(`/freelance/projects/${projectId}?sent=1`);
}

export async function withdrawProposal(proposalId: string, projectId: string) {
  const { user } = await requireRole(['veteran'], '/freelance');
  await createClient().from('proposals').update({ status: 'withdrawn' }).eq('id', proposalId).eq('freelancer_id', user.id);
  revalidatePath(`/freelance/projects/${projectId}`);
}

export async function setProposalStatus(proposalId: string, projectId: string, status: 'shortlisted' | 'declined') {
  await requireRole(['employer'], '/freelance');
  // Row-level security + a database trigger ensure only this project's client can do this.
  await createClient().from('proposals').update({ status }).eq('id', proposalId).eq('project_id', projectId);
  revalidatePath(`/freelance/projects/${projectId}`);
}
