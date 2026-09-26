import 'server-only';
import { createHash } from 'crypto';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

function describe(ua: string) {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'a browser';
  const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'an unknown device';
  return `${browser} on ${os}`;
}

/** Remembers devices each member signs in from and alerts them (in-app, plus email if configured) about new ones. */
export async function recordLogin(userId: string, email?: string | null) {
  try {
    const ua = headers().get('user-agent') ?? 'unknown';
    const hash = createHash('sha256').update(ua).digest('hex');
    const label = describe(ua);
    const admin = createAdminClient();
    const { data: known } = await admin.from('login_devices').select('device_hash').eq('profile_id', userId);
    if ((known ?? []).some((d) => d.device_hash === hash)) {
      await admin.from('login_devices').update({ last_seen: new Date().toISOString() }).eq('profile_id', userId).eq('device_hash', hash);
      return;
    }
    await admin.from('login_devices').insert({ profile_id: userId, device_hash: hash, label });
    if (!(known ?? []).length) return; // first device on record — nothing to compare against
    const when = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' });
    await admin.from('notifications').insert({
      profile_id: userId, type: 'security', link: '/settings/account',
      title: `New sign-in: ${label} · ${when} ET. Not you? Sign out everywhere and change your password.`,
    });
    if (process.env.RESEND_API_KEY && email) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'LanceNest Security <noreply@lancenest.com>',
          to: email,
          subject: 'New sign-in to your LanceNest account',
          text: `Your LanceNest account was just signed in from ${label} (${when} ET).\n\nIf this was you, no action is needed.\nIf it wasn't, go to https://lancenest.com/settings/account, choose "Sign out of all devices", and reset your password.\n\n— LanceNest Security`,
        }),
      });
    }
  } catch (err) {
    console.error('login device check failed:', err);
  }
}
