'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { signIn, type FormState } from '@/app/auth/actions';
import SubmitButton from '../SubmitButton';
import FormMessage from '../FormMessage';
import Turnstile from './Turnstile';

export default function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action] = useFormState<FormState, FormData>(signIn, {});
  return (
    <form action={action} className="space-y-5">
      {notice && <FormMessage message={notice} />}
      <input type="hidden" name="next" value={next ?? ''} />
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
