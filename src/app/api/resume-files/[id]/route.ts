import { NextResponse, type NextRequest } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Résumé download by id. Row-level security returns it only to its owner or to a verified
 * employer it was attached to in an application — then a 60-second link is created.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionProfile();
  if (!session) return NextResponse.redirect(new URL('/login', request.url));
  const { data: resume } = await createClient().from('resumes').select('storage_path, file_name').eq('id', params.id).maybeSingle();
  if (!resume) return new NextResponse('Not available', { status: 404 });
  const { data } = await createAdminClient().storage.from('resumes').createSignedUrl(resume.storage_path as string, 60, { download: resume.file_name as string });
  if (!data?.signedUrl) return new NextResponse('Not available', { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
