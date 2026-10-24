'use client';

import { useEffect, useState } from 'react';

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type BIPEvent = Event & { prompt: () => Promise<void> };

/** "Notifications on this device" plus "Install the app", for the settings page. */
export default function PushToggle() {
  const [state, setState] = useState<'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on'>('loading');
  const [busy, setBusy] = useState(false);
  const [install, setInstall] = useState<BIPEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setInstall(e as BIPEvent); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      if (!KEY || !('serviceWorker' in navigator) || !('PushManager' in window)) return setState(ios && !standalone ? 'ios-install' : 'unsupported');
      if (Notification.permission === 'denied') return setState('denied');
      const reg = await navigator.serviceWorker.ready;
      setState((await reg.pushManager.getSubscription()) ? 'on' : 'off');
    })().catch(() => setState('unsupported'));
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  async function turnOn() {
    setBusy(true);
    try {
      if ((await Notification.requestPermission()) !== 'granted') { setState('denied'); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(KEY) });
      const res = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
      setState(res.ok ? 'on' : 'off');
    } finally { setBusy(false); }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
      setState('off');
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 text-sm">
      {state === 'loading' && <p className="text-muted">Checking this device…</p>}
      {state === 'unsupported' && <p className="text-muted">This browser can’t show LanceNest notifications. You’ll still get them on LanceNest and by email.</p>}
      {state === 'ios-install' && <p className="text-muted">On iPhone or iPad, first add LanceNest to your Home Screen: tap Share, then “Add to Home Screen”. Open it from there and turn notifications on here.</p>}
      {state === 'denied' && <p className="text-muted">Notifications are blocked for LanceNest in this browser’s settings. Allow them there, then come back.</p>}
      {state === 'off' && <button type="button" onClick={turnOn} disabled={busy} className="btn btn-primary">{busy ? 'Turning on…' : 'Turn on notifications on this device'}</button>}
      {state === 'on' && <p className="flex flex-wrap items-center gap-3"><span className="text-olive">✓ Notifications are on for this device.</span><button type="button" onClick={turnOff} disabled={busy} className="text-navy underline">Turn off</button></p>}
      {install && <button type="button" onClick={async () => { await install.prompt(); setInstall(null); }} className="btn btn-outline">Install the LanceNest app</button>}
      <p className="text-xs text-muted">New messages, application updates and hires. Message text is never shown in the notification.</p>
    </div>
  );
}
