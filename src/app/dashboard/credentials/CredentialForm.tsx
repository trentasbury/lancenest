'use client';

import { useState } from 'react';
import { submitCredential } from './actions';

const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

export default function CredentialForm({ userId, trades, states }: { userId: string; trades: string[]; states: [string, string][] }) {
  const [kind, setKind] = useState<'license' | 'certificate'>('license');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const file = fd.get('file');
    if (!(file instanceof File) || !file.size) return setError('Choose a photo or PDF of the license or certificate.');
    if (!EXT[file.type]) return setError('Upload a PDF, JPG, or PNG.');
    if (file.size > 4 * 1024 * 1024) return setError('That file is over 4 MB.');
    setBusy(true); setError(null);
    const path = `${userId}/${Date.now()}-credential.${EXT[file.type]}`;
    const supabase = (await import('@/lib/supabase/client')).createClient();
    const up = await supabase.storage.from('verification-docs').upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { setBusy(false); return setError('The upload didn’t go through. Please try again.'); }
    const send = new FormData();
    for (const k of ['kind', 'name', 'issuer', 'trade', 'state', 'number', 'expires_on']) { const v = fd.get(k); if (typeof v === 'string') send.set(k, v); }
    send.set('document_path', path);
    try { await submitCredential(send); } catch (err) {
      if (err && typeof err === 'object' && 'digest' in err && String((err as { digest?: string }).digest).startsWith('NEXT_REDIRECT')) throw err;
      setBusy(false); setError('That didn’t save. Please try again.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-7">
      <h2 className="font-serif text-2xl font-semibold">Add a license or certificate</h2>
      {error && <p role="alert" className="rounded-lg border border-signal/30 bg-signal/5 px-3.5 py-2.5 text-sm text-signal">{error}</p>}
      <div className="flex gap-2">
        {(['license', 'certificate'] as const).map((k) => (
          <label key={k} className={`cursor-pointer rounded-xl border px-4 py-2 text-sm ${kind === k ? 'border-brass bg-brass/10 font-semibold' : 'border-line'}`}>
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />{k === 'license' ? 'Trade license' : 'Certificate'}
          </label>
        ))}
      </div>
      <div><label className="field-label" htmlFor="name">{kind === 'license' ? 'License name' : 'Certificate name'}</label>
        <input id="name" name="name" required maxLength={120} className="field" placeholder={kind === 'license' ? 'e.g. Certified Master Electrician' : 'e.g. CompTIA Security+'} /></div>
      {kind === 'license' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className="field-label" htmlFor="trade">Trade</label><select id="trade" name="trade" required className="field">{trades.map((x) => <option key={x}>{x}</option>)}</select></div>
          <div><label className="field-label" htmlFor="state">State</label><select id="state" name="state" required className="field" defaultValue=""><option value="" disabled>Choose…</option>{states.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></div>
          <div><label className="field-label" htmlFor="number">License number</label><input id="number" name="number" required maxLength={60} className="field" /></div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="field-label" htmlFor="issuer">{kind === 'license' ? 'Issued by (board)' : 'Issued by'}</label><input id="issuer" name="issuer" maxLength={120} className="field" placeholder={kind === 'license' ? 'e.g. Florida DBPR' : 'e.g. CompTIA'} /></div>
        <div><label className="field-label" htmlFor="expires_on">Expires <span className="font-normal text-muted">(if it does)</span></label><input id="expires_on" name="expires_on" type="date" className="field" /></div>
      </div>
      <div><label className="field-label" htmlFor="file">Photo or PDF of it (up to 4 MB)</label>
        <input id="file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png" required className="field file:mr-3 file:rounded-lg file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-sm file:text-ivory" />
        <p className="mt-1.5 text-xs text-muted">A reviewer checks it{kind === 'license' ? ' against the state board’s public license lookup' : ''}, then deletes the file. Your license number is never shown on your profile.</p></div>
      <button type="submit" disabled={busy} className="btn btn-primary">{busy ? 'Uploading…' : 'Send for review'}</button>
    </form>
  );
}
