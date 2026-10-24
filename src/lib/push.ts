import 'server-only';
import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Push notifications to a member's devices (the installed app, or a browser they allowed). Off until the VAPID keys
 * are set in Vercel. Payloads are encrypted end to end by the Web Push standard; dead subscriptions are removed.
 */
const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const PRIVATE = process.env.VAPID_PRIVATE_KEY ?? '';
export const PUSH_ENABLED = !!PUBLIC && !!PRIVATE;
let configured = false;

/** Only real push services may be saved as an endpoint (stops the server being pointed at other addresses). */
const PUSH_HOSTS = /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com)$/i;
export function validEndpoint(endpoint: string) {
  try { const u = new URL(endpoint); return u.protocol === 'https:' && PUSH_HOSTS.test(u.hostname); } catch { return false; }
}

export async function sendPush(profileId: string, msg: { title: string; body?: string; url?: string; tag?: string }) {
  if (!PUSH_ENABLED) return;
  if (!configured) { webpush.setVapidDetails('mailto:support@lancenest.com', PUBLIC, PRIVATE); configured = true; }
  const admin = createAdminClient();
  const { data } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('profile_id', profileId).limit(10);
  if (!data?.length) return;
  const payload = JSON.stringify({ title: msg.title.slice(0, 120), body: (msg.body ?? '').slice(0, 240), url: msg.url?.startsWith('/') ? msg.url : '/notifications', tag: msg.tag });
  await Promise.all(data.map(async (s) => {
    if (!validEndpoint(s.endpoint as string)) return admin.from('push_subscriptions').delete().eq('id', s.id);
    try {
      await webpush.sendNotification({ endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } }, payload, { TTL: 86400, timeout: 5000 });
      await admin.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id);
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id);
      else console.error('push failed:', code ?? err);
    }
  }));
}
