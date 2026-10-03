'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Counts a page view (privately — see /api/track). Fire-and-forget; never blocks the page. */
export default function PageViewBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    const body = JSON.stringify({ path: pathname, referrer: document.referrer });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
    else fetch('/api/track', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => undefined);
  }, [pathname]);
  // Named clicks: any element with data-track="event_name" is counted (privately, no cookies).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest('[data-track]') as HTMLElement | null;
      const event = el?.dataset.track;
      if (!event) return;
      const body = JSON.stringify({ path: window.location.pathname, event });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  return null;
}
