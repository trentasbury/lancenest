import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { publishPendingDraft } from '@/lib/projectDrafts';

/** Where the confirmation email lands after "Post a project": publishes the waiting project, then opens it. */
export async function GET(request: NextRequest) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, '');
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.redirect(`${site}/login?next=/freelance`, 303);
  const r = await publishPendingDraft(user.id);
  if (r.id) return NextResponse.redirect(`${site}/freelance/projects/${r.id}?posted=1`, 303);
  return NextResponse.redirect(`${site}/freelance/projects/new${r.error ? `?error=${r.error}` : ''}`, 303);
}
