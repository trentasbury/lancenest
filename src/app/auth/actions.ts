'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { LAST_SEEN_COOKIE, NAV_COOKIE, SESSION_START_COOKIE, navCookieOptions, navRoleFor, sessionCookieOptions } from '@/lib/session';
import { recordLogin } from '@/lib/devices';
import { createClient } from '@/lib/supabase/server';
import { roleHome, safeNextPath } from '@/lib/auth';
import type { Role } from '@/lib/types';
import { RESERVED_NAME_MESSAGE, isReservedName } from '@/lib/names';

export type FormState = { error?: string; message?: string };

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

async function startSessionClock() {
  const now = String(Date.now());
  const jar = await cookies();
  jar.set(LAST_SEEN_COOKIE, now, sessionCookieOptions);
  jar.set(SESSION_START_COOKIE, now, sessionCookieOptions);
}

/** Tells pre-built pages which menu to show before they load anything (a display hint only). */
async function setMenuHint(role: string | null | undefined) {
  (await cookies()).set(NAV_COOKIE, navRoleFor(role), navCookieOptions);
}

async function clearSessionClock() {
  const jar = await cookies();
  jar.delete(LAST_SEEN_COOKIE);
  jar.delete(SESSION_START_COOKIE);
  jar.delete(NAV_COOKIE);
}

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? '').trim();
}

/** Turnstile token (present when the bot check is enabled). */
function captcha(formData: FormData) {
  const token = String(formData.get('cf-turnstile-response') ?? '');
  return token || undefined;
}

const CAPTCHA_ERROR = 'Please complete the verification check and try again.';

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, 'email');
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your email and password.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken: captcha(formData) },
  });
  if (error) {
    if (/captcha/i.test(error.message)) return { error: CAPTCHA_ERROR };
    if (/confirm/i.test(error.message)) {
      return { error: 'Please confirm your email first — check your inbox for the activation link.' };
    }
    return { error: 'That email and password combination didn’t match our records.' };
  }

  await startSessionClock();
  await recordLogin(data.user.id, data.user.email);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  await setMenuHint(profile?.role as string | undefined);
  redirect(safeNextPath(formData.get('next')) ?? roleHome((profile?.role as Role) ?? null));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const choice = field(formData, 'role');
  // Military spouses are members too (same features), verified through their service member or documents.
  const role = choice === 'spouse' ? 'veteran' : choice;
  const memberType = choice === 'spouse' ? 'spouse' : 'service_member';
  const fullName = field(formData, 'full_name');
  const email = field(formData, 'email');
  const password = String(formData.get('password') ?? '');

  if (role !== 'veteran' && role !== 'employer') return { error: 'Choose how you’ll use LanceNest.' };
  if (!fullName) return { error: 'Enter your full name.' };
  if (isReservedName(fullName)) return { error: RESERVED_NAME_MESSAGE };
  if (!email) return { error: 'Enter your email address.' };
  if (password.length < 8) return { error: 'Use a password of at least 8 characters.' };

  const home = role === 'employer' ? '/employer/dashboard' : '/dashboard';
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role, member_type: memberType },
      captchaToken: captcha(formData),
      emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(home)}`,
    },
  });

  if (error) {
    if (/captcha/i.test(error.message)) return { error: CAPTCHA_ERROR };
    if (/password/i.test(error.message)) return { error: error.message };
    if (/rate limit/i.test(error.message)) return { error: 'Too many attempts. Please wait a few minutes and try again.' };
    return { error: 'We couldn’t create that account. Please check your details and try again.' };
  }

  // Referral: remember who invited this member (credited when they're verified).
  const ref = field(formData, 'ref').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);
  if (ref && data.user) {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    // Member links use a username; employer links use "c-" plus the company's slug.
    const { data: referrer } = ref.startsWith('c-')
      ? await admin.from('companies').select('id:owner_id').eq('slug', ref.slice(2)).maybeSingle()
      : await admin.from('profiles').select('id').eq('username', ref).in('role', ['veteran', 'admin']).maybeSingle();
    if (referrer?.id && referrer.id !== data.user.id) await admin.from('profiles').update({ referred_by: referrer.id }).eq('id', data.user.id);
  }

  // Email confirmation disabled in Supabase -> a session exists immediately.
  if (data.session) {
    await startSessionClock();
    await setMenuHint(role);
    redirect(home);
  }

  // Supabase returns this same response for an email that is already registered (and sends
  // nothing), so the message has to cover both cases without revealing which one applies.
  return {
    message: `Almost there. If ${email} is new to LanceNest, a confirmation link is on its way — open it to activate your account. Already have an account with this email? No email is sent; just log in, or use “Forgot password?” if you need to reset it.`,
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearSessionClock();
  redirect('/');
}

/** Called by the inactivity timer in the browser. */
export async function signOutForInactivity() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'local' });
  await clearSessionClock();
  redirect('/login?reason=idle');
}

/** "Stay signed in": the request itself refreshes the server-side activity clock in middleware. */
export async function keepAlive() {
  return;
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, 'email');
  if (!email) return { error: 'Enter the email on your account.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
    captchaToken: captcha(formData),
  });
  if (error && /captcha/i.test(error.message)) return { error: CAPTCHA_ERROR };
  // Same message whether or not the account exists (no account enumeration).
  return { message: 'If an account exists for that email, a reset link is on its way.' };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (password.length < 8) return { error: 'Use a password of at least 8 characters.' };
  if (password !== confirm) return { error: 'Those passwords don’t match.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Your reset link has expired. Request a new one.' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: 'We couldn’t update your password. Try requesting a new reset link.' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  await setMenuHint(profile?.role as string | undefined);
  redirect(roleHome((profile?.role as Role) ?? null));
}
