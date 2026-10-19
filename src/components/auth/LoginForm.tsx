'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useFormState } from 'react-dom';
import { signIn, type FormState } from '@/app/auth/actions';
import SubmitButton from '../SubmitButton';
import FormMessage from '../FormMessage';
import Turnstile from './Turnstile';
import GoogleButton from './GoogleButton';
import { safeNextPath } from '@/lib/nav';

/** The message shown above the form for ?reason=… or ?error=… links. */
function noticeFor(p: URLSearchParams): string | undefined {
  const reason = p.get('reason');
  if (reason === 'everywhere') return 'You’ve been signed out on every device. Sign in again — and change your password if you didn’t do this yourself.';
  if (reason === 'idle') return 'For your security, you were signed out after 30 minutes of inactivity.';
  if (reason === 'expired') return 'For your security, sessions end after 12 hours. Please sign in again.';
  if (p.get('error') === 'link') return 'That link has expired or was already used. Log in, or request a new one.';
  if (p.get('error') === 'google') return 'Google sign-in didn’t finish. Please try again, or log in with your email and password.';
  if (p.get('next')?.startsWith('/jobs')) return 'Job listings are for LanceNest members. Log in, or create a free account in under a minute.';
  return undefined;
}

/** The page is pre-built; where to go after login and any notice come from the address, read here. */
export default function LoginForm() {
  const [state, action] = useFormState<FormState, FormData>(signIn, {});
  const [next, setNext] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setNext(safeNextPath(p.get('next')) ?? undefined);
    setNotice(noticeFor(p));
  }, []);
  return (
    <form action={action} className="space-y-5">
      {notice && <FormMessage message={notice} />}
      <input type="hidden" name="next" value={next ?? ''} />
      <GoogleButton href={`/auth/google${next ? `?next=${encodeURIComponent(next)}` : ''}`}
        note={<>New here? Google creates a free account, and you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</>} />
      <div>
        <label htmlFor="email" className="field-label">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="field-label">Password</label>
          <Link href="/forgot-password" className="mb-1.5 text-xs text-brass-dark hover:underline">Forgot password?</Link>
        </div>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
      </div>
      <Turnstile resetSignal={state} />
      <FormMessage error={state.error} />
      <SubmitButton pendingText="Signing in…">Log in</SubmitButton>
      <p className="text-center text-sm text-muted">
        New to LanceNest? <Link href="/signup" className="text-navy underline decoration-brass underline-offset-4">Create an account</Link>
      </p>
    </form>
  );
}
