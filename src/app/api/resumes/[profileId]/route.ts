import { NextResponse, type NextRequest } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Résumé download. Row-level security decides who may see the résumé (the member,
 * or a verified employer already connected to them); only then is a 60-second link created.
 */
export async function GET(request: NextRequest, { params }: { params: { profileId: string } }) {
  const session = await getSessionProfile();
  if (!session) return NextResponse.redirect(new URL('/login', request.url));
  const { data: resume } = await createClient().from('resumes').select('storage_path, file_name').eq('profile_id', params.profileId).maybeSingle();
  if (!resume) return new NextResponse('Not available', { status: 404 });
  const { data } = await createAdminClient().storage.from('resumes').createSignedUrl(resume.storage_path as string, 60, { download: resume.file_name as string });
  if (!data?.signedUrl) return new NextResponse('Not available', { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
