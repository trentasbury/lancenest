'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { roleHome, safeNextPath } from '@/lib/auth';
import type { Role } from '@/lib/types';

export type FormState = { error?: string; message?: string };

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
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

  const supabase = createClient();
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

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  redirect(safeNextPath(formData.get('next')) ?? roleHome((profile?.role as Role) ?? null));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const role = field(formData, 'role');
  const fullName = field(formData, 'full_name');
  const email = field(formData, 'email');
  const password = String(formData.get('password') ?? '');

  if (role !== 'veteran' && role !== 'employer') return { error: 'Choose how you’ll use LanceNest.' };
  if (!fullName) return { error: 'Enter your full name.' };
  if (!email) return { error: 'Enter your email address.' };
  if (password.length < 8) return { error: 'Use a password of at least 8 characters.' };

  const home = role === 'employer' ? '/employer/dashboard' : '/dashboard';
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role },
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

  // Email confirmation disabled in Supabase -> a session exists immediately.
  if (data.session) redirect(home);

  // Supabase returns this same response for an email that is already registered (and sends
  // nothing), so the message has to cover both cases without revealing which one applies.
  return {
    message: `Almost there. If ${email} is new to LanceNest, a confirmation link is on its way — open it to activate your account. Already have an account with this email? No email is sent; just log in, or use “Forgot password?” if you need to reset it.`,
  };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, 'email');
  if (!email) return { error: 'Enter the email on your account.' };

  const supabase = createClient();
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

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Your reset link has expired. Request a new one.' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: 'We couldn’t update your password. Try requesting a new reset link.' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  redirect(roleHome((profile?.role as Role) ?? null));
}
