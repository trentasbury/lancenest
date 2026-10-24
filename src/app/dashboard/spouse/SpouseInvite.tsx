'use client';

import { useActionState, useState } from 'react';
import { makeSpouseInvite, type InviteState } from './actions';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';

export default function SpouseInvite() {
  const [state, action] = useActionState<InviteState>(makeSpouseInvite, {});
  const [copied, setCopied] = useState(false);
  if (state.url) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink/85">Send this link to your spouse by text or email. It works once and stops working in 14 days.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input readOnly value={state.url} className="field font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
          <button type="button" className="btn btn-primary" onClick={async () => { await navigator.clipboard.writeText(state.url!); setCopied(true); }}>{copied ? 'Copied' : 'Copy link'}</button>
        </div>
        <p className="text-xs text-muted">Only send it to your spouse. Whoever opens it and creates a spouse account is verified as your spouse.</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-3">
      {state.error && <FormMessage error={state.error} />}
      <SubmitButton className="btn btn-primary" pendingText="Making your link…">Make an invite link</SubmitButton>
    </form>
  );
}
