import { NextResponse, type NextRequest } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * "Apply on company site": count the click for the employer's analytics, add it to the member's tracker
 * (they confirm or remove it on the job page), then send them to the company's DB-validated link.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionProfile();
  if (!session) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/api/jobs/${params.id}/external`)}`, request.url));
  const supabase = createClient();
  const { data: job } = await supabase.from('jobs').select('id, apply_url, apply_mode, slug').eq('id', params.id).maybeSingle();
  if (!job?.apply_url || job.apply_mode === 'easy') return NextResponse.redirect(new URL(job ? `/jobs/${job.slug}` : '/jobs', request.url));
  if (session.profile?.role === 'veteran') {
    // One record per member and job (a repeat click keeps the existing one).
    await supabase.from('applications').insert({ profile_id: session.user.id, job_id: job.id, source: 'external' }).then(() => undefined, () => undefined);
  }
  return NextResponse.redirect(job.apply_url as string);
}
