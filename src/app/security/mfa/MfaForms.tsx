'use client';

import { useState, useTransition } from 'react';
import { startEnrollment, verifyCode, type MfaState } from './actions';

function CodeForm({ factorId, label }: { factorId: string; label: string }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        start(async () => {
          const r = await verifyCode(factorId, code);
          if (r?.error) setError(r.error);
        });
      }}
      className="space-y-3"
    >
      <label htmlFor="code" className="field-label">{label}</label>
      <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123 456" className="field text-center font-serif text-2xl tracking-[0.3em]" autoFocus />
      {error && <p role="alert" className="text-sm text-signal">{error}</p>}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">{pending ? 'Checking…' : 'Verify'}</button>
    </form>
  );
}

export function VerifyForm({ factorId }: { factorId: string }) {
  return <CodeForm factorId={factorId} label="Enter the code from your authenticator app" />;
}

export function EnrollForm() {
  const [setup, setSetup] = useState<MfaState | null>(null);
  const [pending, start] = useTransition();

  if (!setup?.factorId) {
    return (
      <div className="space-y-3">
        {setup?.error && <p role="alert" className="text-sm text-signal">{setup.error}</p>}
        <button type="button" disabled={pending} onClick={() => start(async () => setSetup(await startEnrollment()))} className="btn btn-primary w-full">
          {pending ? 'Preparing…' : 'Set up two-step login'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink/85">
        <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, or Authy).</li>
        <li>Scan this code, or type the setup key below.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={setup.qr} alt="QR code for your authenticator app" className="mx-auto h-48 w-48 rounded-[4px] border border-line bg-white p-2" />
      <p className="break-all rounded-[3px] bg-paper px-3 py-2 text-center font-mono text-xs text-muted">Setup key: {setup.secret}</p>
      <CodeForm factorId={setup.factorId} label="6-digit code" />
    </div>
  );
}
