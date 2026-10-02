'use client';

import { useEffect } from 'react';

/** Closes open dropdown menus (<details data-autoclose>) when you click elsewhere or press Escape. */
export default function AutoCloseDetails() {
  useEffect(() => {
    const close = (except?: EventTarget | null) => document.querySelectorAll<HTMLDetailsElement>('details[data-autoclose][open]').forEach((d) => { if (!except || !d.contains(except as Node)) d.open = false; });
    const onClick = (e: MouseEvent) => close(e.target);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); };
  }, []);
  return null;
}
