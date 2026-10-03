import { createHash } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const BOT = /bot|crawl|spider|slurp|preview|monitor|headless|lighthouse|pingdom|uptime/i;

/**
 * Private page-view counter. No cookies. Visitors are an anonymous code that changes every day
 * (hash of date + IP + browser + a server secret), so nobody can be followed across days or sites.
 */
export async function POST(request: NextRequest) {
  try {
    const ua = request.headers.get('user-agent') ?? '';
    if (!ua || BOT.test(ua)) return new NextResponse(null, { status: 204 });
    const { path, referrer, event } = (await request.json().catch(() => ({}))) as { path?: string; referrer?: string; event?: string };
    const ev = event && /^[a-z0-9_]{2,60}$/.test(event) ? event : null;
    if (!path || !path.startsWith('/') || path.startsWith('/api')) return new NextResponse(null, { status: 204 });

    const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
    const day = new Date().toISOString().slice(0, 10);
    const visitor = createHash('sha256').update(`${day}|${ip}|${ua}|${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`).digest('hex').slice(0, 32);
    let referrerHost: string | null = null;
    try {
      const h = referrer ? new URL(referrer).hostname.replace(/^www\./, '') : '';
      referrerHost = h && !h.endsWith('lancenest.com') && h !== request.nextUrl.hostname ? h.slice(0, 120) : null;
    } catch { referrerHost = null; }

    const { data: { user } } = await createClient().auth.getUser();
    const admin = createAdminClient();
    await admin.from('page_views').insert({ path: path.split('?')[0].slice(0, 300), visitor, profile_id: user?.id ?? null, referrer_host: ev ? null : referrerHost, event: ev });
    if (ev) return new NextResponse(null, { status: 204 });
    if (user) {
      const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
      await admin.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', user.id).or(`last_active_at.is.null,last_active_at.lt.${fiveMinAgo}`);
    }
  } catch (err) {
    console.error('track failed:', err);
  }
  return new NextResponse(null, { status: 204 });
}
