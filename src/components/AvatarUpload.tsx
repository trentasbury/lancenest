'use client';

import { useRef, useState, useTransition } from 'react';
import { uploadAvatar } from '@/app/settings/account/actions';

/** Any phone photo works: it's cropped square and shrunk to a small JPEG in the browser before upload. */
export default function AvatarUpload({ back = '/settings/account' }: { back?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState('');
  const onFile = async (file: File) => {
    setError('');
    try {
      const url = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const side = Math.min(img.naturalWidth, img.naturalHeight), size = Math.min(640, side);
      const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
      canvas.getContext('2d')!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
      if (!blob) throw new Error('convert');
      const fd = new FormData(); fd.set('photo', new File([blob], 'avatar.jpg', { type: 'image/jpeg' })); fd.set('back', back);
      startTransition(() => { void uploadAvatar(fd); });
    } catch { setError('That photo couldn’t be read. Try a JPG or PNG, or a screenshot of the photo.'); }
  };
  return (
    <div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
      <button type="button" onClick={() => input.current?.click()} disabled={busy} className="btn btn-outline">{busy ? 'Uploading…' : 'Upload photo'}</button>
      {error && <p className="mt-2 text-sm text-signal">{error}</p>}
    </div>
  );
}
