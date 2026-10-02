'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { reactToPost } from '@/app/network/actions';

/** Instant reactions: the button updates immediately and saves in the background. */
export default function ReactionPicker({ postId, initial, reactions }: { postId: string; initial: string | null; reactions: [string, string, string][] }) {
  const [current, setCurrent] = useState<string | null>(initial);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', away);
    return () => document.removeEventListener('click', away);
  }, []);
  const mine = reactions.find(([k]) => k === current);
  const pick = (key: string) => {
    setCurrent((c) => (c === key ? null : key));
    setOpen(false);
    startTransition(() => { void reactToPost(postId, key); });
  };
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={`rounded-[3px] px-3 py-2 hover:bg-cream ${mine ? 'font-semibold text-brass-dark' : 'text-ink'}`}>
        {mine ? `${mine[2]} ${mine[1]}` : '✦ React'}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-1 flex flex-wrap gap-1 rounded-[4px] border border-line bg-ivory p-2 shadow-card sm:w-max">
          {reactions.map(([key, label, glyph]) => (
            <button key={key} type="button" onClick={() => pick(key)} className={`rounded-full border px-3 py-1.5 text-xs ${current === key ? 'border-brass bg-brass/15 text-brass-dark' : 'border-line hover:border-brass'}`}>
              <span aria-hidden="true">{glyph}</span> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
