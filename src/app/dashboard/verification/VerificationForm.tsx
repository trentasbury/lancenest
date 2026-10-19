'use client';

import { useState } from 'react';
import { submitVerification } from './actions';
import { ID_TYPES } from './idTypes';

const MAX_BYTES = 4 * 1024 * 1024;
const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
const FILE_INPUT = 'field file:mr-3 file:rounded-lg file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-sm file:text-ivory';

/** Uploads both files straight to private storage (no 4 MB request limit), then opens the review request. */
export default function VerificationForm({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const doc = fd.get('document');
    const id = fd.get('id_document');
    if (!(doc instanceof File) || !doc.size) return setError('Choose your service document.');
    if (!(id instanceof File) || !id.size) return setError('Choose a photo of your ID.');
    for (const f of [doc, id]) {
      if (!EXT[f.type]) return setError(`“${f.name}” isn’t a PDF, JPG, or PNG. On iPhone, take a screenshot of the photo and upload that.`);
      if (f.size > MAX_BYTES) return setError(`“${f.name}” is over 4 MB. Try a PDF export or a smaller photo.`);
    }

    setBusy(true);
    setError(null);
    const stamp = Date.now();
    const docPath = `${userId}/${stamp}-service.${EXT[doc.type]}`;
    const idPath = `${userId}/${stamp}-photo-id.${EXT[id.type]}`;
    const supabase = (await import('@/lib/supabase/client')).createClient();
    const bucket = supabase.storage.from('verification-docs');
    const [a, b] = await Promise.all([
      bucket.upload(docPath, doc, { contentType: doc.type, upsert: false }),
      bucket.upload(idPath, id, { contentType: id.type, upsert: false }),
    ]);
    if (a.error || b.error) {
      await bucket.remove([docPath, idPath]);
      setBusy(false);
      return setError('An upload didn’t go through. Please check your connection and try again.');
    }

    const send = new FormData();
    send.set('document_path', docPath);
    send.set('id_document_path', idPath);
    for (const k of ['doc_type', 'id_type', 'member_note', 'redacted', 'id_consent']) {
      const v = fd.get(k);
      if (typeof v === 'string') send.set(k, v);
    }
    try {
      await submitVerification(send); // redirects to the confirmation (or an error message)
      setBusy(false);
    } catch (err) {
      // A redirect is thrown on purpose by Next.js; anything else is a real failure.
      if (err && typeof err === 'object' && 'digest' in err && String((err as { digest?: string }).digest).startsWith('NEXT_REDIRECT')) throw err;
      await bucket.remove([docPath, idPath]);
      setBusy(false);
      setError('Something went wrong. Please try again.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-6 p-7">
      <div>
        <h2 className="font-serif text-2xl font-semibold">Submit your documents</h2>
        <p className="mt-1 text-sm text-muted">Two files: proof of service and a photo ID. A reviewer checks that they match, then deletes both.</p>
      </div>

      {error && <p role="alert" className="rounded-lg border border-signal/30 bg-signal/5 px-3.5 py-2.5 text-sm text-signal">{error}</p>}

      <fieldset className="space-y-4 rounded-xl border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-ink">1. Proof of service</legend>
        <div>
          <label htmlFor="doc_type" className="field-label">Document type</label>
          <select id="doc_type" name="doc_type" className="field" defaultValue="DD-214">
            <option>DD-214</option>
            <option>VA benefit summary letter</option>
            <option>LES</option>
            <option>Orders</option>
            <option>NGB-22</option>
          </select>
        </div>
        <div>
          <label htmlFor="document" className="field-label">File (PDF, JPG, or PNG · up to 4 MB)</label>
          <input id="document" name="document" type="file" accept={ACCEPT} required className={FILE_INPUT} />
          <p className="mt-1.5 text-xs text-muted">Black out your Social Security number. Keep your name, date of birth, branch, and dates of service visible.</p>
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-ink">2. Photo ID</legend>
        <div>
          <label htmlFor="id_type" className="field-label">ID type</label>
          <select id="id_type" name="id_type" className="field" defaultValue="drivers_license">
            {Object.entries(ID_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="id_document" className="field-label">Photo of the front (JPG, PNG, or PDF · up to 4 MB)</label>
          <input id="id_document" name="id_document" type="file" accept={ACCEPT} required className={FILE_INPUT} />
          <p className="mt-1.5 text-xs text-muted">Cover the ID number. Keep your photo, full name, and date of birth readable. Never a military, VA, or other federal ID card.</p>
        </div>
        <div>
          <label htmlFor="member_note" className="field-label">Name different on the two documents? <span className="font-normal text-muted">(optional)</span></label>
          <input id="member_note" name="member_note" maxLength={300} placeholder="e.g. Married in 2021; DD-214 shows my maiden name" className="field" />
        </div>
      </fieldset>

      <div className="space-y-3">
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="redacted" required className="mt-0.5 h-4 w-4 accent-navy" />
          <span>I’ve blacked out my Social Security number and covered my ID number.</span>
        </label>
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="id_consent" required className="mt-0.5 h-4 w-4 accent-navy" />
          <span>I agree that a LanceNest reviewer may compare my photo ID with my service document to confirm they’re both mine. Both files are deleted as soon as the reviewer approves or rejects them.</span>
        </label>
      </div>

      <button type="submit" className="btn btn-primary" disabled={busy} aria-busy={busy}>
        {busy ? 'Uploading securely…' : 'Submit for review'}
      </button>
    </form>
  );
}
