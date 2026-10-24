import { NextResponse, type NextRequest } from 'next/server';
import { confirm } from '@/lib/newsletter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, '');
  const ok = await confirm(request.nextUrl.searchParams.get('t') ?? '');
  return NextResponse.redirect(`${site}/newsletter?${ok ? 'confirmed=1' : 'error=link'}`, 303);
}
