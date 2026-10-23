'use client';

import { useEffect, useState } from 'react';

const EVENT = 'ln:toast';

/** Show a short confirmation at the bottom of the screen (e.g. "Report sent."). */
export function toast(text: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: text }));
}

/** Renders confirmations from toast(); mounted once in the root layout. */
export default function Toaster() {
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const on = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (!text) return;
      setMsg({ text, id: Date.now() });
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 5000);
    };
    window.addEventListener(EVENT, on);
    return () => { window.removeEventListener(EVENT, on); clearTimeout(timer); };
  }, []);
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {msg && (
        <p key={msg.id} className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl bg-navy-deep px-4 py-3 text-sm font-medium text-ivory shadow-lift">
          <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2f7a3e] text-[11px] text-white">✓</span>
          {msg.text}
          <button type="button" onClick={() => setMsg(null)} className="ml-2 text-cream/70 hover:text-ivory" aria-label="Dismiss">×</button>
        </p>
      )}
    </div>
  );
}
