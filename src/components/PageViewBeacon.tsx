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
  return null;
}
