import { NextResponse, type NextRequest } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { getMyCompany } from '@/lib/employer';
import { createAdminClient } from '@/lib/supabase/admin';

const csv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** Federal & Enterprise: every job, applicant, source, timestamp, and status change — for internal hiring records. */
export async function GET(request: NextRequest) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, '');
  const session = await getSessionProfile();
  if (!session || session.profile?.role !== 'employer') return NextResponse.redirect(`${site}/login`);
  const company = await getMyCompany(session.user.id);
  if (!company || !['federal', 'enterprise'].includes(company.plan)) return NextResponse.redirect(`${site}/employers`);
  const admin = createAdminClient();
  const { data: jobs } = await admin.from('jobs').select('id, title, status, location, salary_min, salary_max, employment_type, posted_at, created_at').eq('company_id', company.id).order('created_at');
  const jobIds = (jobs ?? []).map((j) => j.id as string);
  const { data: apps } = jobIds.length ? await admin.from('applications').select('id, job_id, status, source, applied_at, profile:profiles!applications_profile_id_fkey(full_name)').in('job_id', jobIds) : { data: [] };
  const appIds = (apps ?? []).map((a) => a.id as string);
  const { data: hist } = appIds.length ? await admin.from('application_status_history').select('application_id, status, changed_at').in('application_id', appIds).order('changed_at') : { data: [] };
  const byApp = new Map<string, string[]>();
  (hist ?? []).forEach((h) => byApp.set(h.application_id as string, [...(byApp.get(h.application_id as string) ?? []), `${h.status} @ ${new Date(h.changed_at as string).toISOString()}`]));
  const lines = ['job_title,job_status,job_posted,location,pay_min,pay_max,employment_type,applicant,applied_at,source,current_status,status_history'];
  for (const j of jobs ?? []) {
    const jobApps = (apps ?? []).filter((a) => a.job_id === j.id) as unknown as { id: string; status: string; source: string; applied_at: string; profile: { full_name: string } | null }[];
    const base = [j.title, j.status, j.posted_at ?? j.created_at, j.location, j.salary_min, j.salary_max, j.employment_type];
    if (!jobApps.length) lines.push([...base, '', '', '', '', ''].map(csv).join(','));
    for (const a of jobApps) lines.push([...base, a.profile?.full_name, a.applied_at, a.source, a.status, (byApp.get(a.id) ?? []).join('; ')].map(csv).join(','));
  }
  return new NextResponse(lines.join('\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="lancenest-hiring-records-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' } });
}
