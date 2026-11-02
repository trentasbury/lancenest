'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Terms reminders in freelance conversations, the way Upwork shows them in Messages: before a job is booked, keep the
 * conversation on LanceNest; once it's booked, keep bookings for work found here on LanceNest. Either person can
 * close it, and it stays hidden for 30 days in every conversation.
 */
const HIDE_DAYS = 30;
const COPY = {
  communication: {
    title: 'Keep the conversation on LanceNest until the job is booked.',
    body: 'Sharing contact details, or arranging the work somewhere else before it’s booked here, goes against the Terms of Service. If someone asks you to, report it from the ⋯ menu.',
  },
  payment: {
    title: 'Book work you found here through LanceNest.',
    body: 'For 24 months after you meet here, book this person for new work through LanceNest. Arranging it directly to skip the booking fee goes against the Terms of Service. If someone asks you to, report it from the ⋯ menu.',
  },
} as const;

export default function TosReminder({ kind }: { kind: keyof typeof COPY }) {
  const key = `ln_tos_${kind}`;
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      const hidden = Number(window.localStorage.getItem(key) ?? 0);
      setShow(!(hidden && Date.now() - hidden < HIDE_DAYS * 86400000));
    } catch { setShow(true); }
  }, [key]);
  if (!show) return null;
  const c = COPY[kind];
  return (
    <div role="note" className="mt-4 flex items-start gap-3 rounded-xl border border-brass/50 bg-brass/10 p-3 text-sm">
      <div className="flex-1">
        <p className="font-semibold text-navy">{c.title}</p>
        <p className="mt-0.5 text-ink/80">{c.body} <Link href="/terms" className="text-navy underline">Terms</Link></p>
      </div>
      <button type="button" aria-label="Close reminder" className="rounded-md px-2 text-lg leading-none text-muted hover:bg-white/60 hover:text-ink"
        onClick={() => { try { window.localStorage.setItem(key, String(Date.now())); } catch { /* still closes for now */ } setShow(false); }}>×</button>
    </div>
  );
}
