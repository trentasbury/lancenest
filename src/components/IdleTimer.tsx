'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { keepAlive, signOutForInactivity } from '@/app/auth/actions';

const IDLE_MS = 30 * 60 * 1000;
const WARN_MS = 2 * 60 * 1000;
const PING_EVERY_MS = 5 * 60 * 1000; // while active, refresh the server-side clock
const KEY = 'ln_last_activity';

/** Warns before the inactivity sign-out and keeps every open tab in sync. */
export default function IdleTimer() {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastPing = useRef(Date.now());
  const signingOut = useRef(false);

  const read = () => Number(localStorage.getItem(KEY)) || Date.now();

  const markActive = useCallback((ping: boolean) => {
    const now = Date.now();
    localStorage.setItem(KEY, String(now));
    setSecondsLeft(null);
    if (ping || now - lastPing.current > PING_EVERY_MS) {
      lastPing.current = now;
      keepAlive().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, String(Date.now()));
    let throttle = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - throttle < 10_000) return;
      throttle = now;
      markActive(false);
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'visibilitychange'];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const tick = setInterval(() => {
      const idleFor = Date.now() - read();
      if (idleFor >= IDLE_MS) {
        if (!signingOut.current) {
          signingOut.current = true;
          signOutForInactivity().catch(() => { window.location.href = '/login?reason=idle'; });
        }
      } else if (idleFor >= IDLE_MS - WARN_MS) {
        setSecondsLeft(Math.ceil((IDLE_MS - idleFor) / 1000));
      } else {
        setSecondsLeft(null);
      }
    }, 1000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(tick);
    };
  }, [markActive]);

  if (secondsLeft === null) return null;
  const m = Math.floor(secondsLeft / 60);
  const s = String(secondsLeft % 60).padStart(2, '0');
  return (
    <div role="alertdialog" aria-live="assertive" aria-labelledby="idle-title" className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/60 px-5">
      <div className="card w-full max-w-sm p-7 text-center">
        <p id="idle-title" className="font-serif text-2xl">Still there?</p>
        <p className="mt-2 text-sm text-muted">For your security, you’ll be signed out in</p>
        <p className="mt-2 font-serif text-4xl text-navy">{m}:{s}</p>
        <button type="button" onClick={() => markActive(true)} className="btn btn-primary mt-6 w-full">Stay signed in</button>
      </div>
    </div>
  );
}
