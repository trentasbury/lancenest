'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState } from 'react-dom';
import { signUp, type FormState } from '@/app/auth/actions';
import SubmitButton from '../SubmitButton';
import FormMessage from '../FormMessage';
import Turnstile from './Turnstile';

const OPTIONS = [
  { value: 'veteran', title: 'I’m a Veteran', body: 'Active duty, transitioning, or veteran — build your profile and find your next role.' },
  { value: 'employer', title: 'I’m an Employer', body: 'Post roles, search verified military talent, and build your veteran pipeline.' },
] as const;

export default function SignupForm({ defaultRole }: { defaultRole: 'veteran' | 'employer' }) {
  const [role, setRole] = useState<'veteran' | 'employer'>(defaultRole);
  const [state, action] = useFormState<FormState, FormData>(signUp, {});

  if (state.message) {
    return (
      <div className="space-y-5">
        <FormMessage message={state.message} />
        <Link href="/login" className="btn btn-primary w-full">Go to log in</Link>
        <Link href="/forgot-password" className="btn btn-outline w-full">Forgot password?</Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <fieldset>
        <legend className="field-label">How will you use LanceNest?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`cursor-pointer rounded-[4px] border p-4 transition-colors ${
                role === o.value ? 'border-brass bg-brass/10' : 'border-line bg-white hover:border-brass/50'
              }`}
            >
              <input
                type="radio"
                name="role"
                value={o.value}
                checked={role === o.value}
                onChange={() => setRole(o.value)}
                className="sr-only"
              />
              <span className="block font-serif text-lg font-semibold text-ink">{o.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">{o.body}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="full_name" className="field-label">{role === 'employer' ? 'Your full name' : 'Full name'}</label>
        <input id="full_name" name="full_name" autoComplete="name" required className="field" />
      </div>
      <div>
        <label htmlFor="email" className="field-label">{role === 'employer' ? 'Work email' : 'Email'}</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      <div>
        <label htmlFor="password" className="field-label">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="field" />
        <p className="mt-1.5 text-xs text-muted">At least 8 characters.</p>
      </div>

      <Turnstile resetSignal={state} />
      <FormMessage error={state.error} />
      <SubmitButton pendingText="Creating your account…">Create account</SubmitButton>
      <p className="text-center text-xs text-muted">
        Service members verify their service after signup to unlock jobs and the network. By creating an account, you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
      </p>
      <p className="text-center text-sm text-muted">
        Already a member? <Link href="/login" className="text-navy underline decoration-brass underline-offset-4">Log in</Link>
      </p>
    </form>
  );
}
