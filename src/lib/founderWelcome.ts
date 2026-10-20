import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE, isDeliverable } from '@/lib/email';

/**
 * The founder's personal welcome: a plain letter (no banner or buttons) from Trent, sent once to each service member
 * the morning after their verification is approved. Sent by the daily job (8 AM Eastern).
 *
 * Replies: set FOUNDER_REPLY_TO in Vercel (e.g. trent@lancenest.com once its inbox forwards to you) and the letter
 * says "just reply"; until then it points to the Help page, so no message is ever lost.
 */
const FROM = 'Trent Asbury <trent@lancenest.com>';
const BATCH = 40;                       // leaves room in the daily email allowance for everything else
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // only members verified in the last 7 days (never a blast to older members)

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function founderWelcome(m: { firstName: string; branch: string | null; username: string | null }) {
  const marine = m.branch === 'Marine Corps';
  const replyTo = (process.env.FOUNDER_REPLY_TO ?? '').trim();
  const profileUrl = m.username ? `${SITE}/veterans/${m.username}?tab=posts` : `${SITE}/dashboard/profile`;
  const subject = `Welcome to LanceNest, ${m.firstName}`;

  // Each paragraph is [plain text, html]. Links appear only in the HTML version, so the letter reads like a person wrote it.
  const paras: [string, string][] = [
    [`Hi ${m.firstName},`, `Hi ${esc(m.firstName)},`],
    [
      `I'm Trent, the founder of LanceNest. Your service is verified, and I wanted to welcome you personally and say thank you: for your service${m.branch ? ` in the ${m.branch}` : ''}, and for trusting LanceNest with what comes next.`,
      `I’m Trent, the founder of LanceNest. Your service is verified, and I wanted to welcome you personally and say thank you: for your service${m.branch ? ` in the ${esc(m.branch)}` : ''}, and for trusting LanceNest with what comes next.`,
    ],
    [
      `${marine ? 'As a fellow Marine' : 'As a Marine veteran myself'}, I know how hard it can be to turn what you did in uniform into the next chapter. I built LanceNest so the people who served have one place where that experience is understood and valued, by employers who are looking for exactly that.`,
      `${marine ? 'As a fellow Marine' : 'As a Marine veteran myself'}, I know how hard it can be to turn what you did in uniform into the next chapter. I built LanceNest so the people who served have one place where that experience is understood and valued, by employers who are looking for exactly that.`,
    ],
    ['Three things that help new members most:', 'Three things that help new members most:'],
    [
      '1. Finish your profile. Add your military career, skills, and a résumé. Employers search by MOS, skills, and location.',
      `1. <a href="${SITE}/dashboard/profile" style="color:#1c2b3a;">Finish your profile</a>. Add your military career, skills, and a résumé. Employers search by MOS, skills, and location.`,
    ],
    [
      '2. Introduce yourself on your profile wall. Share where you served and what you’re working toward.',
      `2. <a href="${profileUrl}" style="color:#1c2b3a;">Introduce yourself on your profile wall</a>. Share where you served and what you’re working toward.`,
    ],
    [
      '3. Follow people who served where you did, and set up job alerts for the roles you want.',
      `3. <a href="${SITE}/people" style="color:#1c2b3a;">Follow people who served where you did</a>, and <a href="${SITE}/dashboard/alerts" style="color:#1c2b3a;">set up job alerts</a> for the roles you want.`,
    ],
    replyTo
      ? ['If anything is confusing, something isn’t working, or you have an idea to make LanceNest better, just reply to this email. It comes straight to me, and I read every one.',
         'If anything is confusing, something isn’t working, or you have an idea to make LanceNest better, just reply to this email. It comes straight to me, and I read every one.']
      : [`If anything is confusing, something isn’t working, or you have an idea to make LanceNest better, send it through the Help page (${SITE}/help). It comes straight to me, and I read every one.`,
         `If anything is confusing, something isn’t working, or you have an idea to make LanceNest better, send it through the <a href="${SITE}/help" style="color:#1c2b3a;">Help page</a>. It comes straight to me, and I read every one.`],
    [`${marine ? 'Semper Fi' : 'Welcome to the community'},`, `${marine ? 'Semper Fi' : 'Welcome to the community'},`],
  ];
  const signature = ['Trent Asbury', 'Founder, LanceNest', 'U.S. Marine Corps veteran'];
  const footer = `You’re receiving this one-time welcome because you joined LanceNest. ${SITE.replace(/^https?:\/\//, '')}`;

  const text = [...paras.map(([t]) => t), signature.join('\n'), '', footer.replace('’', "'")].join('\n\n');
  const html = `<!doctype html><html><body style="margin:0;padding:24px 16px;background:#ffffff;">
<div style="max-width:560px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#222222;">
${paras.map(([, h]) => `<p style="margin:0 0 16px;">${h}</p>`).join('\n')}
<p style="margin:0 0 28px;">${signature.map(esc).join('<br>')}</p>
<p style="margin:0;font-size:12px;color:#888888;">${esc(footer)}</p>
</div></body></html>`;
  return { subject, text, html, replyTo: replyTo || null };
}

async function send(to: string, mail: ReturnType<typeof founderWelcome>) {
  if (!process.env.RESEND_API_KEY || !isDeliverable(to)) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject: mail.subject, html: mail.html, text: mail.text, ...(mail.replyTo ? { reply_to: mail.replyTo } : {}) }),
  });
  if (!res.ok) console.error('founder welcome failed:', res.status, await res.text().catch(() => ''));
  return res.ok;
}

/** Daily job: send the welcome to members verified in the last 7 days who haven't had it. Returns how many were sent. */
export async function sendFounderWelcomes(now = Date.now()) {
  const admin = createAdminClient();
  const { data: recent } = await admin.from('verification_requests').select('profile_id').eq('status', 'verified').gte('reviewed_at', new Date(now - WINDOW_MS).toISOString());
  const ids = Array.from(new Set((recent ?? []).map((r) => r.profile_id as string)));
  if (!ids.length) return 0;
  const { data: due } = await admin.from('veteran_profiles').select('profile_id').in('profile_id', ids).eq('verification_status', 'verified').is('founder_welcome_sent_at', null).limit(BATCH);
  const dueIds = (due ?? []).map((v) => v.profile_id as string);
  if (!dueIds.length) return 0;
  const [{ data: profs }, { data: service }] = await Promise.all([
    admin.from('profiles').select('id, full_name, username, banned').in('id', dueIds),
    admin.from('military_service').select('profile_id, branch, start_date').in('profile_id', dueIds).order('start_date', { ascending: false }),
  ]);
  let sent = 0;
  for (const p of profs ?? []) {
    if (p.banned) continue;
    const { data: u } = await admin.auth.admin.getUserById(p.id as string);
    const email = u?.user?.email;
    if (!email) continue;
    const firstName = String(p.full_name ?? '').trim().split(/\s+/)[0] || 'there';
    const branch = ((service ?? []).find((s) => s.profile_id === p.id)?.branch as string | undefined) ?? null;
    if (await send(email, founderWelcome({ firstName, branch, username: (p.username as string | null) ?? null }))) {
      await admin.from('veteran_profiles').update({ founder_welcome_sent_at: new Date().toISOString() }).eq('profile_id', p.id as string);
      sent++;
    }
  }
  return sent;
}
