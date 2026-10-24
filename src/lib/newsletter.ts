import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE, isDeliverable, sendEmail } from '@/lib/email';

/**
 * The public weekly jobs newsletter (anyone can subscribe; members also get their own weekly digest).
 * Double opt-in: nothing is sent until the address is confirmed. Sending is held until BUSINESS_MAILING_ADDRESS is set,
 * because U.S. law (CAN-SPAM) requires a postal address in marketing email.
 */
export const NEWSLETTER_SENDING = !!(process.env.BUSINESS_MAILING_ADDRESS ?? '').trim();
const hash = (t: string) => createHash('sha256').update(t).digest('hex');
const HOURLY_NEW_LIMIT = 100;

export async function subscribe(emailRaw: string, source: string | null): Promise<'sent' | 'already' | 'invalid' | 'busy'> {
  const email = emailRaw.trim().toLowerCase().slice(0, 200);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email) || !isDeliverable(email)) return 'invalid';
  const admin = createAdminClient();
  const { data: row } = await admin.from('newsletter_subscribers').select('id, status, created_at, confirmed_at').eq('email', email).maybeSingle();
  if (row?.status === 'active') return 'already';
  // One confirmation email per address per day, and a cap on new sign-ups per hour (stops anyone using the form to spam).
  if (row && row.status === 'pending' && Date.now() - Date.parse(row.created_at as string) < 86400000) return 'sent';
  const { count } = await admin.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 3600000).toISOString());
  if ((count ?? 0) >= HOURLY_NEW_LIMIT) return 'busy';
  const token = randomBytes(24).toString('base64url');
  const { error } = await admin.from('newsletter_subscribers').upsert({ email, status: 'pending', token_hash: hash(token), source, created_at: new Date().toISOString(), confirmed_at: null }, { onConflict: 'email' });
  if (error) return 'busy';
  await sendEmail(email, {
    subject: 'Confirm your LanceNest jobs newsletter', preheader: 'One click and you’re on the list.', tone: 'notice', badge: 'Confirm',
    heading: 'Confirm your subscription', paragraphs: ['Every week: new jobs from verified employers hiring veterans, pay insights and transition guides. Free, and you can unsubscribe anytime.', 'If you didn’t ask for this, ignore this email and you won’t hear from us.'],
    cta: { label: 'Confirm my subscription', url: `${SITE}/newsletter/confirm?t=${token}` },
  });
  return 'sent';
}

export async function confirm(token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return false;
  const admin = createAdminClient();
  const { data } = await admin.from('newsletter_subscribers').update({ status: 'active', confirmed_at: new Date().toISOString() })
    .eq('token_hash', hash(token)).eq('status', 'pending').gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()).select('id').maybeSingle();
  return !!data;
}
