'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import Turnstile from '@/components/auth/Turnstile';
import { postProjectAsGuest, type GuestPostState } from './actions';

export default function GuestPostForm({ started, categories, licensed, feeNote }: { started: string; categories: string[]; licensed: string[]; feeNote: string }) {
  const [state, action, pending] = useActionState<GuestPostState, FormData>(postProjectAsGuest, {});
  if (state.message) {
    return (
      <div className="card p-8 text-center">
        <p className="eyebrow">Check your email</p>
        <p className="mx-auto mt-3 max-w-xl text-ink/85">{state.message}</p>
        <p className="mt-4 text-xs text-muted">Nothing is public until you confirm. The link works for 24 hours.</p>
      </div>
    );
  }
  return (
    <form action={action} className="card grid gap-5 p-7 sm:grid-cols-2">
      <input type="hidden" name="started" value={started} />
      {/* A trap for bots: hidden from people and screen readers. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="company_website">Company website</label>
        <input id="company_website" name="company_website" tabIndex={-1} autoComplete="off" />
      </div>

      <p className="eyebrow sm:col-span-2">The job</p>
      <div className="sm:col-span-2"><label className="field-label" htmlFor="title">What do you need done?</label>
        <input id="title" name="title" required minLength={4} maxLength={140} placeholder="e.g. Replace a 3-ton AC condenser, or build a 5-page website" className="field" /></div>
      <div className="sm:col-span-2"><label className="field-label" htmlFor="description">Details</label>
        <textarea id="description" name="description" required minLength={40} rows={6} maxLength={8000} placeholder="What the job is, when you need it done, and anything a pro should know. Leave out phone numbers, emails and links: you can share them once you hire." className="field" /></div>
      <div><label className="field-label" htmlFor="work_location">Where</label>
        <input id="work_location" name="work_location" maxLength={120} placeholder="Remote, or the city and state of the job" className="field" /></div>
      <div><label className="field-label" htmlFor="category">Category</label>
        <select id="category" name="category" className="field">{categories.map((c) => <option key={c} value={c}>{c}{licensed.includes(c) ? ' (licensed pros only)' : ''}</option>)}</select></div>
      <div><label className="field-label" htmlFor="budget_type">Budget</label>
        <select id="budget_type" name="budget_type" className="field"><option value="fixed">Fixed price</option><option value="hourly">Hourly</option></select></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="field-label" htmlFor="budget_min">Min ($)</label><input id="budget_min" name="budget_min" inputMode="numeric" className="field" /></div>
        <div><label className="field-label" htmlFor="budget_max">Max ($)</label><input id="budget_max" name="budget_max" inputMode="numeric" className="field" /></div>
      </div>
      <details className="rounded-xl border border-line bg-paper p-4 text-sm sm:col-span-2">
        <summary className="cursor-pointer font-medium text-ink">Is this a freelance job, not an employee role?</summary>
        <div className="mt-2 space-y-1">
          <label className="flex items-center gap-2"><input type="checkbox" name="set_hours" className="accent-navy" />You’ll set the person’s working hours</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="supervise" className="accent-navy" />You’ll supervise their work day to day</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="indefinite" className="accent-navy" />The work is ongoing with no defined end</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="exclusive" className="accent-navy" />They can’t work for other clients</label>
          <label className="mt-2 flex items-start gap-2 text-xs text-ink/85"><input type="checkbox" name="classification_ack" className="mt-0.5 accent-navy" />If any box above is checked, I understand this may be better as an employee role, and I’m responsible for classifying it correctly.</label>
        </div>
      </details>
      <p className="text-xs text-muted sm:col-span-2">{feeNote}</p>

      <p className="eyebrow pt-2 sm:col-span-2">Your free client account</p>
      <div><label className="field-label" htmlFor="full_name">Full name</label><input id="full_name" name="full_name" required autoComplete="name" maxLength={120} className="field" /></div>
      <div><label className="field-label" htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" maxLength={254} className="field" /></div>
      <div className="sm:col-span-2"><label className="field-label" htmlFor="password">Password</label><input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" className="field" />
        <p className="mt-1 text-xs text-muted">At least 10 characters. You’ll use this to message and book the pro you choose.</p></div>
      <label className="flex items-start gap-2 text-sm text-ink/85 sm:col-span-2"><input type="checkbox" name="agree" required className="mt-1 accent-navy" />
        <span>I agree to the <Link href="/terms" className="text-navy underline">Terms</Link> and the <Link href="/conduct" className="text-navy underline">Code of Conduct</Link>. I won’t ask for upfront fees, gift cards or payment outside LanceNest.</span></label>
      <div className="sm:col-span-2"><Turnstile resetSignal={state} /></div>
      {state.error && <p role="alert" className="rounded-lg border border-signal/40 bg-signal/5 px-3 py-2 text-sm text-signal sm:col-span-2">{state.error}</p>}
      <div className="sm:col-span-2"><button className="btn btn-primary" disabled={pending}>{pending ? 'Posting…' : 'Post my project'}</button>
        <span className="ml-3 text-sm text-muted">Already have an account? <Link href="/login?next=/freelance/projects/new" className="text-navy underline">Log in</Link></span></div>
    </form>
  );
}
