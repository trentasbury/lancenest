'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// A one-click fix for a stuck/corrupted local login session. Signs out,
// then manually wipes any leftover Supabase auth data from this browser's
// storage, since a stale or malformed session can sometimes make the
// normally-instant getSession() check hang instead of erroring cleanly.

export default function ClearSession() {
  const [done, setDone] = useState(false);

  async function clearEverything() {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // Ignore — we're clearing manually below regardless of whether this succeeds.
    }

    if (typeof window !== 'undefined') {
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith('sb-') || key.includes('supabase'))
        .forEach((key) => window.localStorage.removeItem(key));

      Object.keys(window.sessionStorage || {})
        .filter((key) => key.startsWith('sb-') || key.includes('supabase'))
        .forEach((key) => window.sessionStorage.removeItem(key));
    }

    setDone(true);
    setTimeout(() => {
      window.location.href = '/login';
    }, 1500);
  }

  return (
    <main className="plain-surface container" style={{ padding: '80px 32px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 26, marginBottom: 16 }}>Clear stuck login session</h1>
      <p style={{ color: 'var(--slate)', marginBottom: 24, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
        If login or the directory is stuck loading, this clears any stored
        session data in this browser and sends you back to a clean login
        page.
      </p>
      {done ? (
        <p style={{ color: 'var(--wood)' }}>Cleared — redirecting to login...</p>
      ) : (
        <button className="btn btn-primary" onClick={clearEverything}>Clear session & go to login</button>
      )}
    </main>
  );
}
