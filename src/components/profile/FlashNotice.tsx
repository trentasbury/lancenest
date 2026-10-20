'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

/**
 * One-line confirmation after a form on the page (report, talent pool, recommendation).
 * Forms redirect back to the same page without moving the scroll position, so the notice
 * brings itself into view when it appears.
 */
export default function FlashNotice({ text, ok, link }: { text: string; ok: boolean; link?: [string, string] }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    if (box.top < 72 || box.bottom > window.innerHeight) {
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
    }
  }, [text]);
  return (
    <p ref={ref} role="status" className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-3 text-sm font-medium ${ok ? 'border-[#2f7a3e]/40 bg-[#2f7a3e]/10 text-[#24602f]' : 'border-signal/30 bg-signal/5 text-signal'}`}>
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] text-white ${ok ? 'bg-[#2f7a3e]' : 'bg-signal'}`}>{ok ? '✓' : '!'}</span>
        {text}
      </span>
      {link && <Link href={link[1]} className="underline underline-offset-2">{link[0]}</Link>}
    </p>
  );
}
