import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lancenest.com').replace(/\/$/, '');
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

type Tone = 'success' | 'notice' | 'alert';
export type EmailContent = {
  subject: string; preheader: string; heading: string; paragraphs: string[];
  cta?: { label: string; url: string }; tone?: Tone; badge?: string;
};

const BADGE: Record<Tone, [string, string, string]> = {
  success: ['#e8f1ea', '#2f7a3e', '#2f7a3e'], notice: ['#f6efe2', '#8a6a33', '#b08d57'], alert: ['#f8e9e7', '#a33a2c', '#a33a2c'],
};

/** Branded, email-client-safe HTML (tables + inline styles; renders in Gmail, Outlook, Apple Mail) plus plain text. */
export function renderEmail(c: EmailContent) {
  const tone = c.tone ?? 'notice';
  const [bg, fg, border] = BADGE[tone];
  const badge = c.badge ? `<div style="display:inline-block;margin:0 0 18px;padding:5px 12px;background:${bg};border:1px solid ${border};border-radius:999px;font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${fg};">${esc(c.badge)}</div>` : '';
  const paras = c.paragraphs.map((p) => `<p style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#2b2b2b;">${esc(p)}</p>`).join('');
  const button = c.cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 6px;"><tr><td style="background:#0f2233;border-radius:3px;"><a href="${esc(c.cta.url)}" style="display:inline-block;padding:14px 28px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:0.5px;color:#f4efe6;text-decoration:none;">${esc(c.cta.label)} &rarr;</a></td></tr></table>` : '';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4efe6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f4efe6;">${esc(c.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe6;"><tr><td align="center" style="padding:32px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3dccf;border-radius:6px;">
<tr><td style="background:#0f2233;padding:28px 32px;text-align:center;border-radius:6px 6px 0 0;">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:7px;color:#c9a96e;">LANCENEST</div>
<div style="margin-top:8px;font-family:Georgia,serif;font-size:11px;letter-spacing:4px;color:#8f9aa6;">&#8212;&#8212;&#8212; &#9733; &#8212;&#8212;&#8212;</div>
</td></tr>
<tr><td style="padding:36px 32px 8px;">${badge}
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:normal;line-height:1.25;color:#0f2233;">${esc(c.heading)}</h1>
${paras}${button}</td></tr>
<tr><td style="padding:26px 32px 0;"><div style="border-top:1px solid #e3dccf;"></div></td></tr>
<tr><td style="padding:18px 32px 28px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#7a746a;">
Questions? Just reply, or write <a href="mailto:support@lancenest.com" style="color:#0f2233;">support@lancenest.com</a>.<br>
<strong style="color:#0f2233;">LanceNest</strong> &middot; The professional network for verified service members<br>
Independent — not affiliated with the DoD, the VA, or any branch of service.
</td></tr></table>
</td></tr></table></body></html>`;
  const text = [c.heading, '', ...c.paragraphs, ...(c.cta ? ['', `${c.cta.label}: ${c.cta.url}`] : []), '', '— LanceNest · support@lancenest.com'].join('\n');
  return { html, text };
}

/** Sends through Resend. Quietly skips (and logs) if RESEND_API_KEY isn't set yet. */
export async function sendEmail(to: string, c: EmailContent) {
  if (!process.env.RESEND_API_KEY) { console.warn('email skipped (RESEND_API_KEY not set):', c.subject); return; }
  const { html, text } = renderEmail(c);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'LanceNest <noreply@lancenest.com>', to, reply_to: 'support@lancenest.com', subject: c.subject, html, text }),
  });
  if (!res.ok) console.error('email failed:', res.status, await res.text().catch(() => ''));
}

/** In-app notification + branded email to a member. Never throws — a failed email must not break an admin action. */
export async function notifyMember(profileId: string, n: { type: string; title: string; link: string; email?: EmailContent; inApp?: boolean }) {
  try {
    const admin = createAdminClient();
    if (n.inApp !== false) await admin.from('notifications').insert({ profile_id: profileId, type: n.type, title: n.title, link: n.link });
    if (n.email) {
      const { data } = await admin.auth.admin.getUserById(profileId);
      if (data?.user?.email) await sendEmail(data.user.email, n.email);
    }
  } catch (err) {
    console.error('notifyMember failed:', err);
  }
}
