'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RESERVED_NAME_MESSAGE, isReservedName } from '@/lib/names';
import {
  GUEST_DRAFTS_PER_IP_PER_DAY, checkFormStart, ipHash, isDisposableEmail, publishPendingDraft, validateGuestProject,
} from '@/lib/projectDrafts';

export type GuestPostState = { error?: string; message?: string };

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const CAPTCHA_ERROR = 'Please complete the verification check and try again.';
const sent = (email: string) =>
  `Almost done. Open the link we just sent to ${email} and your project goes live. Already have a LanceNest account with this email? No email is sent: log in and post it from Your projects.`;

/**
 * Post a project and create a free client account in one step. Layers of protection: a bot check, a hidden trap
 * field, a minimum fill time, throwaway-email blocking, 3 posts per connection per day, the same scam, contact,
 * explicit-content and SSN screening as published projects (stricter for new accounts), and email confirmation
 * before anything goes live.
 */
export async function postProjectAsGuest(_prev: GuestPostState, fd: FormData): Promise<GuestPostState> {
  if (await getSessionProfile()) redirect('/freelance/projects/new');

  // Bots fill the hidden field and submit within seconds. They get the normal reply and nothing is saved.
  const start = checkFormStart(String(fd.get('started') ?? ''));
  if (!start.valid) return { error: 'This form timed out. Please reload the page and try again.' };
  const email = String(fd.get('email') ?? '').trim().toLowerCase().slice(0, 254);
  if (String(fd.get('company_website') ?? '').trim() || start.tooFast) return { message: sent(email || 'your email') };

  const v = await validateGuestProject(fd);
  if (v.error || !v.payload) return { error: v.error ?? 'Please check the project and try again.' };

  const fullName = String(fd.get('full_name') ?? '').trim().slice(0, 120);
  const password = String(fd.get('password') ?? '');
  if (fullName.length < 2) return { error: 'Enter your full name.' };
  if (isReservedName(fullName)) return { error: RESERVED_NAME_MESSAGE };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: 'Enter a valid email address.' };
  if (isDisposableEmail(email)) return { error: 'Please use an email address you keep. Temporary inboxes can’t be used to post.' };
  if (password.length < 10) return { error: 'Use a password of at least 10 characters.' };
  if (fd.get('agree') !== 'on') return { error: 'Please agree to the Terms and the Code of Conduct.' };

  const ip = ((await headers()).get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const hash = ipHash(ip);
  const admin = createAdminClient();
  const { count } = await admin.from('project_drafts').select('id', { count: 'exact', head: true })
    .eq('ip_hash', hash).gte('created_at', new Date(Date.now() - 86400000).toISOString());
  if ((count ?? 0) >= GUEST_DRAFTS_PER_IP_PER_DAY) return { error: 'Too many projects were posted from this connection today. Please try again tomorrow.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: {
      data: { full_name: fullName, role: 'client' },
      captchaToken: String(fd.get('cf-turnstile-response') ?? '') || undefined,
      emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent('/hire/post/confirmed')}`,
    },
  });
  if (error) {
    if (/captcha/i.test(error.message)) return { error: CAPTCHA_ERROR };
    if (/password/i.test(error.message)) return { error: error.message };
    if (/rate limit/i.test(error.message)) return { error: 'Too many attempts. Please wait a few minutes and try again.' };
    return { error: 'We couldn’t create your account. Please check your details and try again.' };
  }

  // A brand-new account: hold the project until the email is confirmed. (An existing email gets no draft and no email.)
  if (data.user && (data.user.identities?.length ?? 0) > 0) {
    await admin.from('project_drafts').insert({ profile_id: data.user.id, payload: v.payload, ip_hash: hash });
  }
  // If email confirmation is ever switched off, there's a session already: publish now.
  if (data.session && data.user) {
    const r = await publishPendingDraft(data.user.id);
    redirect(r.id ? `/freelance/projects/${r.id}?posted=1` : `/freelance/projects/new${r.error ? `?error=${r.error}` : ''}`);
  }
  return { message: sent(email) };
}
