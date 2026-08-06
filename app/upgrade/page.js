'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function Upgrade() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [monthlyEarnings, setMonthlyEarnings] = useState(600);

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

  const feeSavings = monthlyEarnings * 0.05;
  const netGain = feeSavings - 20;
  const breakeven = 400;

  return (
    <main className="plain-surface container" style={{ padding: '72px 32px', maxWidth: 600 }}>
      <span className="eyebrow">LanceNest Pro</span>
      <h1 style={{ fontSize: 42, margin: '16px 0 8px' }}>Stop giving away 5% for nothing.</h1>
      <p style={{ color: 'var(--slate)', fontSize: 16, lineHeight: 1.7, marginBottom: 8 }}>
        Free is 15% per job. Pro is 10% — plus real advantages that help you win more work.
      </p>

      <div style={{ margin: '36px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--wood)', fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: 20 }}>—</span>
          <p style={{ margin: 0, fontSize: 15 }}><strong>Save 5% on every project</strong> — 10% instead of 15%</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--wood)', fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: 20 }}>—</span>
          <p style={{ margin: 0, fontSize: 15 }}><strong>Priority search placement</strong> — show up first in the directory</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--wood)', fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: 20 }}>—</span>
          <p style={{ margin: 0, fontSize: 15 }}><strong>Verified badge</strong> on your public profile</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--wood)', fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: 20 }}>—</span>
          <p style={{ margin: 0, fontSize: 15 }}>
            <strong>AI proposal tools</strong>
            <span style={{ fontSize: 11, color: 'var(--slate)', marginLeft: 8 }}>Coming soon</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--wood)', fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: 20 }}>—</span>
          <p style={{ margin: 0, fontSize: 15 }}>
            <strong>Instant payouts</strong>
            <span style={{ fontSize: 11, color: 'var(--slate)', marginLeft: 8 }}>Coming soon</span>
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <p className="meta" style={{ marginBottom: 14 }}>See when Pro pays for itself</p>
        <label style={{ marginTop: 0 }}>Your typical monthly earnings</label>
        <input
          type="range"
          min="0"
          max="2000"
          step="50"
          value={monthlyEarnings}
          onChange={(e) => setMonthlyEarnings(Number(e.target.value))}
          style={{ width: '100%', marginTop: 10 }}
        />
        <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 600, margin: '10px 0 4px' }}>
          ${monthlyEarnings.toLocaleString()}<span style={{ fontSize: 14, color: 'var(--slate)', fontFamily: 'Inter, sans-serif' }}>/month</span>
        </p>
        <p style={{ fontSize: 14, color: netGain >= 0 ? 'var(--wood)' : 'var(--slate)' }}>
          {netGain >= 0
            ? `Pro saves you ~$${netGain.toFixed(0)}/month at this level.`
            : `You'd need about $${breakeven}/month in earnings for Pro to pay for itself.`}
        </p>
      </div>

      <div style={{ padding: '24px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', marginBottom: 28 }}>
        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 40, fontWeight: 500 }}>$20</span>
        <span style={{ color: 'var(--slate)', fontSize: 14 }}> / month</span>
        <p style={{ fontSize: 13, color: 'var(--slate)', marginTop: 6 }}>Pays for itself past ~$400/month in earnings</p>
      </div>

      {error && <p style={{ color: '#b3261e', fontSize: 14, marginBottom: 16 }}>{error}</p>}

      <button className="btn btn-primary" onClick={startSubscribe} disabled={loading}>
        {loading ? 'Redirecting...' : 'Upgrade to Pro'}
      </button>

      <p style={{ fontSize: 12, color: 'var(--slate)', marginTop: 24 }}>
        Free is always free — no credit card required. See the full breakdown on our{' '}
        <a href="/pricing" style={{ textDecoration: 'underline' }}>pricing page</a>.
      </p>
    </main>
  );
}
