'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function Upgrade() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function startSubscribe() {
    setLoading(true);
    setError('');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Log in as a freelancer to upgrade.');
      setLoading(false);
      return;
    }

    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setError(data.error || 'Something went wrong.');
      setLoading(false);
    }
  }

  return (
    <main className="container" style={{ padding: '72px 32px', maxWidth: 560 }}>
      <span className="eyebrow">LanceNest Pro</span>
      <h1 style={{ fontSize: 42, margin: '16px 0 8px' }}>Get seen first.</h1>
      <p style={{ color: 'var(--slate)', fontSize: 16, lineHeight: 1.7, marginBottom: 8 }}>
        Same 10% fee on every job — Pro doesn't change that. It just gives your
        profile an edge.
      </p>

      <div style={{ margin: '36px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--gold)', fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: 20 }}>—</span>
          <p style={{ margin: 0, fontSize: 15 }}>Priority placement at the top of the freelancer directory</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--gold)', fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: 20 }}>—</span>
          <p style={{ margin: 0, fontSize: 15 }}>A Pro badge on your public profile</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--gold)', fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: 20 }}>—</span>
          <p style={{ margin: 0, fontSize: 15 }}>Cancel anytime — no contract</p>
        </div>
      </div>

      <div style={{ padding: '24px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', marginBottom: 28 }}>
        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 40, fontWeight: 500 }}>$15</span>
        <span style={{ color: 'var(--slate)', fontSize: 14 }}> / month</span>
      </div>

      {error && <p style={{ color: '#b3261e', fontSize: 14, marginBottom: 16 }}>{error}</p>}

      <button className="btn btn-primary" onClick={startSubscribe} disabled={loading}>
        {loading ? 'Redirecting...' : 'Upgrade to Pro'}
      </button>

      <p style={{ fontSize: 12, color: 'var(--slate)', marginTop: 24 }}>
        See the full breakdown of fees on our <a href="/pricing" style={{ textDecoration: 'underline' }}>pricing page</a>.
      </p>
    </main>
  );
}
