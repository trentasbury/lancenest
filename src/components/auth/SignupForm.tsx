'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useActionState } from 'react';
import { signUp, type FormState } from '@/app/auth/actions';
import SubmitButton from '../SubmitButton';
import FormMessage from '../FormMessage';
import Turnstile from './Turnstile';
import GoogleButton from './GoogleButton';

const OPTIONS = [
  { value: 'veteran', title: 'I’m a service member or veteran', body: 'Active duty, Guard, Reserve, transitioning, or veteran.' },
  { value: 'spouse', title: 'I’m a military spouse', body: 'Remote and portable jobs, freelance work, and a network that gets PCS moves.' },
  { value: 'employer', title: 'I’m hiring for a company', body: 'Any company or recruiter. Post roles and search verified military talent.' },
  { value: 'client', title: 'I want to hire a freelancer', body: 'Free for anyone. Book a verified veteran for a project, from web design to home repairs.' },
] as const;

/** The page is pre-built; ?role=employer and ?ref=… (referral links) are read here, in the browser. */
export default function SignupForm() {
  const [role, setRole] = useState<'veteran' | 'spouse' | 'employer' | 'client'>('veteran');
  const [referral, setReferral] = useState<string | undefined>();
  // Where to land after sign-up (e.g. the service a visitor picked on the public Hire page). Same-site paths only.
  const [next, setNext] = useState<string | undefined>();
  // Terms box, like Upwork's: required for email sign-up and for Google.
  const [agree, setAgree] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('role') === 'employer') setRole('employer');
    if (p.get('role') === 'spouse') setRole('spouse');
    if (p.get('role') === 'client') setRole('client');
    const ref = p.get('ref');
    if (ref) setReferral(ref.slice(0, 80));
    const n = p.get('next');
    if (n && /^\/(?![/\\])/.test(n)) setNext(n.slice(0, 200));
  }, []);
  const [state, action] = useActionState<FormState, FormData>(signUp, {});

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
      {referral && <input type="hidden" name="ref" value={referral} />}
      {next && <input type="hidden" name="next" value={next} />}
      <fieldset>
        <legend className="field-label">How will you use LanceNest?</legend>
        <div className="grid gap-2.5">
          {OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`cursor-pointer rounded-xl border px-4 py-3 transition-colors ${
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

      <label className="flex items-start gap-2.5 rounded-xl border border-line bg-white px-4 py-3 text-sm leading-relaxed text-ink/90">
        <input type="checkbox" name="terms" required checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 accent-navy" />
        <span>Yes, I understand and agree to the LanceNest <Link href="/terms" target="_blank" className="text-navy underline">Terms of Service</Link>, including the <Link href="/conduct" target="_blank" className="text-navy underline">Code of Conduct</Link>, <Link href="/privacy" target="_blank" className="text-navy underline">Privacy Policy</Link>, and <Link href="/terms#non-circumvention" target="_blank" className="text-navy underline">Non-Circumvention Policy</Link>.</span>
      </label>

      <GoogleButton disabled={!agree} href={`/auth/google?role=${role}&terms=1${referral ? `&ref=${encodeURIComponent(referral)}` : ''}${next ? `&next=${encodeURIComponent(next)}` : ''}`} />

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
        Members verify after signup to unlock jobs and the network.
      </p>
      <p className="text-center text-sm text-muted">
        Already a member? <Link href="/login" className="text-navy underline decoration-brass underline-offset-4">Log in</Link>
      </p>
    </form>
  );
}
