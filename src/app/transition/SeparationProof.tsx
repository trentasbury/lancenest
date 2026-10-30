'use client';

import { useState } from 'react';
import { submitSeparationCheck } from './actions';

const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

/** Uploads proof of the separation date straight to the member's private folder, then opens a review. */
export default function SeparationProof({ userId, defaultDate }: { userId: string; defaultDate: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const file = fd.get('file');
    if (!(file instanceof File) || !file.size) return setError('Choose a photo or PDF of your orders, LES or DD-214.');
    if (!EXT[file.type]) return setError('Upload a PDF, JPG, or PNG.');
    if (file.size > 4 * 1024 * 1024) return setError('That file is over 4 MB.');
    setBusy(true); setError(null);
    const path = `${userId}/${Date.now()}-separation.${EXT[file.type]}`;
    const supabase = (await import('@/lib/supabase/client')).createClient();
    const up = await supabase.storage.from('verification-docs').upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { setBusy(false); return setError('The upload didn’t go through. Please try again.'); }
    const send = new FormData();
    send.set('requested_date', String(fd.get('requested_date') ?? ''));
    send.set('document_path', path);
    try { await submitSeparationCheck(send); } catch (err) {
      if (err && typeof err === 'object' && 'digest' in err && String((err as { digest?: string }).digest).startsWith('NEXT_REDIRECT')) throw err;
      setBusy(false); setError('That didn’t send. Please try again.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && <p role="alert" className="rounded-lg border border-signal/30 bg-signal/5 px-3 py-2 text-xs text-signal">{error}</p>}
      <div><label className="field-label" htmlFor="requested_date">Date on your orders</label>
        <input id="requested_date" name="requested_date" type="date" required defaultValue={defaultDate ?? ''} className="field" /></div>
      <div><label className="field-label" htmlFor="sep-file">Orders, LES or DD-214 (PDF, JPG or PNG, up to 4 MB)</label>
        <input id="sep-file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png" required className="field file:mr-3 file:rounded-lg file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-sm file:text-ivory" /></div>
      <p className="text-xs text-muted">Black out your Social Security number first. A reviewer checks the date, then deletes the file.</p>
      <button type="submit" disabled={busy} className="btn btn-outline w-full">{busy ? 'Uploading…' : 'Send for review'}</button>
    </form>
  );
}
