'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { requestPasswordReset, type FormState } from '@/app/auth/actions';
import SubmitButton from '../SubmitButton';
import FormMessage from '../FormMessage';
import Turnstile from './Turnstile';

export default function ForgotPasswordForm() {
  const [state, action] = useFormState<FormState, FormData>(requestPasswordReset, {});
  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="email" className="field-label">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      <Turnstile resetSignal={state} />
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="text-navy underline decoration-brass underline-offset-4">Back to log in</Link>
      </p>
    </form>
  );
}
