import { NextResponse, type NextRequest } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PAID, getMyCompany } from '@/lib/employer';

const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** Applicant export for paid plans (for importing into an ATS). No email addresses are exported. */
export async function GET(request: NextRequest) {
  const session = await getSessionProfile();
  if (!session || session.profile?.role !== 'employer') return new NextResponse('Not authorized', { status: 401 });
  const company = await getMyCompany(session.user.id);
  if (!company || !PAID.includes(company.plan)) return new NextResponse('Available on paid plans', { status: 403 });
  const jobId = request.nextUrl.searchParams.get('job') ?? '';
  const supabase = createClient();
  const { data: job } = await supabase.from('jobs').select('id, title, slug').eq('id', jobId).eq('company_id', company.id).maybeSingle();
  if (!job) return new NextResponse('Not found', { status: 404 });
  const { data } = await supabase.from('applications')
    .select('status, applied_at, profile:profiles!applications_profile_id_fkey(full_name, username, headline, service_summary, location, verified)')
    .eq('job_id', job.id).neq('status', 'withdrawn').order('applied_at');
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  const lines = [['Name', 'Headline', 'Service', 'Location', 'Verified', 'Status', 'Applied', 'Profile'].map(cell).join(',')];
  for (const a of (data ?? []) as unknown as { status: string; applied_at: string; profile: Record<string, string | boolean | null> | null }[]) {
    const p = a.profile ?? {};
    lines.push([p.full_name, p.headline, p.service_summary, p.location, p.verified ? 'Yes' : 'No', a.status, a.applied_at.slice(0, 10), p.username ? `${site}/veterans/${p.username}` : ''].map(cell).join(','));
  }
  return new NextResponse(lines.join('\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="applicants-${job.slug}.csv"`, 'Cache-Control': 'no-store' },
  });
}
