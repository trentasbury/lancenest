'use client';

import { useState } from 'react';
import { addPortfolioItem } from '../actions';

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Add a portfolio item, with an optional picture of the work (uploaded to the member's own storage folder). */
export default function PortfolioForm({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const file = fd.get('image');
    fd.delete('image');
    setBusy(true); setError(null);
    if (file instanceof File && file.size) {
      if (!EXT[file.type]) { setBusy(false); return setError('Pictures can be JPG, PNG or WebP.'); }
      if (file.size > 8 * 1024 * 1024) { setBusy(false); return setError('That picture is over 8 MB.'); }
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const path = `${userId}/portfolio-${Date.now()}.${EXT[file.type]}`;
      const up = await supabase.storage.from('post-media').upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) { setBusy(false); return setError('The picture didn’t upload. Please try again.'); }
      fd.set('image_url', supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl);
    }
    try { await addPortfolioItem(fd); } catch (err) {
      if (err && typeof err === 'object' && 'digest' in err && String((err as { digest?: string }).digest).startsWith('NEXT_REDIRECT')) throw err;
      setBusy(false); setError('That didn’t save. Please try again.');
    }
  }
  return (
    <form onSubmit={onSubmit} className="mt-5 grid gap-3 sm:grid-cols-2">
      {error && <p role="alert" className="text-sm text-signal sm:col-span-2">{error}</p>}
      <input name="title" required placeholder="Project title" className="field" />
      <input name="url" placeholder="Link (optional)" className="field" />
      <textarea name="description" rows={2} placeholder="What you did and the result" className="field sm:col-span-2" />
      <div className="sm:col-span-2"><label className="field-label" htmlFor="pf-image">Picture of the work <span className="font-normal text-muted">(optional)</span></label>
        <input id="pf-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" className="field file:mr-3 file:rounded-lg file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-sm file:text-ivory" />
        <p className="mt-1 text-xs text-muted">No faces of people who didn’t agree to it, no unit insignia, bases or equipment (OPSEC), and no customer addresses.</p></div>
      <div><button type="submit" disabled={busy} className="btn btn-outline">{busy ? 'Adding…' : 'Add to portfolio'}</button></div>
    </form>
  );
}
