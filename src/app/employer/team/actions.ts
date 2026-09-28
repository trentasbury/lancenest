'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE, notifyMember } from '@/lib/email';

/** Owner adds an existing LanceNest employer account to the company. Seat limits are enforced by the database. */
export async function addTeamMember(formData: FormData) {
  const { user } = await requireRole(['employer'], '/employer/team');
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const { data: company } = await createClient().from('companies').select('id, name, is_verified').eq('owner_id', user.id).maybeSingle();
  if (!company?.is_verified) redirect('/employer/dashboard?verify=required');
  const admin = createAdminClient();
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const target = list?.users.find((u) => u.email?.toLowerCase() === email);
  if (!target || target.id === user.id) redirect('/employer/team?error=notfound');
  const [{ data: prof }, { data: owns }] = await Promise.all([
    admin.from('profiles').select('role, full_name').eq('id', target.id).maybeSingle(),
    admin.from('companies').select('id').eq('owner_id', target.id).maybeSingle(),
  ]);
  if (prof?.role !== 'employer' || owns) redirect('/employer/team?error=ineligible');
  const { error } = await admin.from('company_members').insert({ company_id: company.id, profile_id: target.id });
  if (error) redirect(`/employer/team?error=${error.code === 'P0013' ? 'seats' : error.code === '23505' ? 'taken' : 'save'}`);
  await notifyMember(target.id, { type: 'team', link: '/employer/dashboard', title: `You were added to ${company.name}’s hiring team on LanceNest.`,
    email: { subject: `You’ve joined ${company.name} on LanceNest`, preheader: 'You can now post jobs and review candidates for your company.', tone: 'success', badge: 'Team',
      heading: `You’re on ${company.name}’s hiring team.`, paragraphs: ['You can now post and manage jobs, review applicants, search candidates, and message service members for your company.'],
      cta: { label: 'Open the employer dashboard', url: `${SITE}/employer/dashboard` } } });
  revalidatePath('/employer/team');
  redirect('/employer/team?added=1');
}

export async function removeTeamMember(profileId: string) {
  const { user } = await requireRole(['employer'], '/employer/team');
  const { data: company } = await createClient().from('companies').select('id').eq('owner_id', user.id).maybeSingle();
  if (!company) redirect('/employer/dashboard');
  await createAdminClient().from('company_members').delete().eq('company_id', company.id).eq('profile_id', profileId);
  revalidatePath('/employer/team');
}
