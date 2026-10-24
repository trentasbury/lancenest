import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PUSH_ENABLED, validEndpoint } from '@/lib/push';

export const dynamic = 'force-dynamic';

/** Saves (POST) or removes (DELETE) this device's push subscription for the signed-in member. */
export async function POST(request: NextRequest) {
  if (!PUSH_ENABLED) return NextResponse.json({ error: 'off' }, { status: 503 });
  if (request.headers.get('origin') && new URL(request.headers.get('origin')!).host !== request.nextUrl.host) return NextResponse.json({ error: 'origin' }, { status: 403 });
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });
  const body = await request.json().catch(() => null) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null;
  const endpoint = String(body?.endpoint ?? '');
  const p256dh = String(body?.keys?.p256dh ?? '');
  const auth = String(body?.keys?.auth ?? '');
  if (!validEndpoint(endpoint) || endpoint.length > 1000 || !/^[A-Za-z0-9_-]{20,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{8,100}$/.test(auth)) return NextResponse.json({ error: 'bad' }, { status: 400 });
  const admin = createAdminClient();
  const { count } = await admin.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('profile_id', user.id);
  if ((count ?? 0) >= 10) {
    // Ten devices at most: forget the oldest.
    const { data: oldest } = await admin.from('push_subscriptions').select('id').eq('profile_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (oldest) await admin.from('push_subscriptions').delete().eq('id', oldest.id);
  }
  const { error } = await admin.from('push_subscriptions').upsert({ profile_id: user.id, endpoint, p256dh, auth, user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300) }, { onConflict: 'endpoint' });
  return NextResponse.json({ ok: !error });
}

export async function DELETE(request: NextRequest) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });
  const body = await request.json().catch(() => null) as { endpoint?: string } | null;
  if (body?.endpoint) await createAdminClient().from('push_subscriptions').delete().eq('profile_id', user.id).eq('endpoint', String(body.endpoint).slice(0, 1000));
  return NextResponse.json({ ok: true });
}
