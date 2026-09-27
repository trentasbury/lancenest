import { NextResponse, type NextRequest } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/** "Apply on company site": record it in the member's tracker, then send them to the (DB-validated) company link. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionProfile();
  if (!session) return NextResponse.redirect(new URL(`/login`, request.url));
  const supabase = createClient();
  const { data: job } = await supabase.from('jobs').select('id, apply_url, slug').eq('id', params.id).maybeSingle();
  if (!job?.apply_url) return NextResponse.redirect(new URL('/jobs', request.url));
  if (session.profile?.role === 'veteran') {
    await supabase.from('applications').insert({ profile_id: session.user.id, job_id: job.id, source: 'external' }).then(() => undefined, () => undefined);
  }
  return NextResponse.redirect(job.apply_url as string);
}
