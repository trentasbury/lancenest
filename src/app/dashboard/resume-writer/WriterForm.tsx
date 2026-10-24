'use client';

import { useActionState, useState } from 'react';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { writeResume, type AiState } from './actions';

export default function WriterForm({ services }: { services: { id: string; label: string }[] }) {
  const [state, action] = useActionState<AiState, FormData>(writeResume, {});
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-6">
      <form action={action} className="card space-y-4 p-7">
        {state.error && <FormMessage error={state.error} />}
        <div><label className="field-label" htmlFor="service_id">Which part of your service?</label>
          <select id="service_id" name="service_id" className="field" defaultValue={services[0]?.id ?? ''}>
            {services.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            <option value="">None — I’ll paste my duties below</option>
          </select></div>
        <div><label className="field-label" htmlFor="target">Job you’re aiming for <span className="font-normal text-muted">(optional)</span></label>
          <input id="target" name="target" maxLength={120} className="field" placeholder="e.g. Operations manager, logistics analyst" /></div>
        <div><label className="field-label" htmlFor="notes">Duties, achievements or evaluation bullets <span className="font-normal text-muted">(optional, helps a lot)</span></label>
          <textarea id="notes" name="notes" rows={6} maxLength={3000} className="field" placeholder="e.g. Led 25 Marines; accountable for $4M of equipment with zero losses; ranked #1 of 12 SSgts…" />
          <p className="mt-1.5 text-xs text-muted">Never paste anything classified or controlled (CUI), Social Security numbers, or other people’s names.</p></div>
        <SubmitButton className="btn btn-primary" pendingText="Writing… about 10 seconds">Write my résumé section</SubmitButton>
      </form>
      {state.text && (
        <div className="card p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-2xl font-semibold">Your draft</h2>
            <button type="button" className="btn btn-outline" onClick={async () => { await navigator.clipboard.writeText(state.text!); setCopied(true); }}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <pre className="mt-4 whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-ink/90">{state.text}</pre>
          <p className="mt-4 text-xs text-muted">AI drafts can be wrong. Check every line is true before you use it. Paste the bullets into your profile’s service description to put them on your résumé. {typeof state.left === 'number' ? `${state.left} AI draft${state.left === 1 ? '' : 's'} left this month.` : ''}</p>
        </div>
      )}
    </div>
  );
}
