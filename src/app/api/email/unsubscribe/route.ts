import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyUnsubscribe } from '@/lib/emailLinks';

export const dynamic = 'force-dynamic';

/** One-click unsubscribe (RFC 8058): mail apps POST here from the List-Unsubscribe header. */
export async function POST(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const u = p.get('u') ?? '', l = p.get('l') ?? '', t = p.get('t') ?? '';
  if (!verifyUnsubscribe(u, l, t)) return NextResponse.json({ ok: false }, { status: 400 });
  if (l === 'digest') await createAdminClient().from('profiles').update({ email_digest: false }).eq('id', u);
  return NextResponse.json({ ok: true });
}
