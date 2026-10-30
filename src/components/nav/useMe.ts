'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import type { Role } from '@/lib/types';

/**
 * The signed-in member as the menu sees them. Pages are pre-built and identical for everyone, so the
 * menu works out who is signed in here, in the browser:
 *  1. The page's head script sets <html data-nav> from the menu hint cookie before first paint,
 *     so the right menu shows instantly (CSS does the switching).
 *  2. Signed-in visitors then load their name, photo, and unread count from /api/me.
 * Signed-out visitors never call the server for any of this.
 */
export type Me =
  | { signedIn: false }
  | { signedIn: true; id: string; role: Role | null; fullName: string | null; username: string | null; avatarUrl: string | null; companySlug?: string | null; unread: number };

let current: Me | null = null;
let inflight = false;
let lastFetch = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readHint(): string {
  const m = document.cookie.match(/(?:^|;\s*)ln_nav=([^;]*)/);
  return m && m[1] ? decodeURIComponent(m[1]) : 'out';
}

function setHintAttr(value: string) {
  if (document.documentElement.getAttribute('data-nav') !== value) document.documentElement.setAttribute('data-nav', value);
}

/** Re-reads the hint (sign-in and sign-out change it without a full page load) and refreshes details. */
export function refreshMe(force = false) {
  if (typeof window === 'undefined') return;
  const hint = readHint();
  const wasOut = document.documentElement.getAttribute('data-nav') === 'out';
  setHintAttr(hint);
  if (hint === 'out') {
    if (!current || current.signedIn) { current = { signedIn: false }; emit(); }
    return;
  }
  if (inflight || (!force && !wasOut && current?.signedIn && Date.now() - lastFetch < 30_000)) return;
  inflight = true;
  lastFetch = Date.now();
  fetch('/api/me', { cache: 'no-store', credentials: 'same-origin' })
    .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
    .then((data) => {
      if (!data) return;
      current = data;
      setHintAttr(data.signedIn ? (data.role === 'veteran' || data.role === 'employer' || data.role === 'admin' || data.role === 'client' ? data.role : 'member') : 'out');
      emit();
    })
    .catch(() => undefined)
    .finally(() => { inflight = false; });
}

/** Called the moment someone presses Log out, so the menu switches without waiting. */
export function markSignedOut() {
  current = { signedIn: false };
  if (typeof document !== 'undefined') setHintAttr('out');
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMe(): Me | null {
  const me = useSyncExternalStore(subscribe, () => current, () => null);
  const pathname = usePathname();
  useEffect(() => {
    // Opening Notifications marks them read: clear the badge right away.
    if (pathname === '/notifications' && current?.signedIn && current.unread) { current = { ...current, unread: 0 }; emit(); }
    refreshMe();
  }, [pathname]);
  useEffect(() => {
    const onFocus = () => refreshMe();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);
  return me;
}
