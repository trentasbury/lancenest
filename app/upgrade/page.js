'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function Upgrade() {
  const [plan, setPlan] = useState('pro');
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
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ plan }),
    });

    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setError(data.error || 'Something went wrong.');
      setLoading(false);
    }
  }

  const rate = plan === 'pro' ? 0.10 : 0.08;
  const price = plan === 'pro' ? 19 : 29;
  const feeSavings = monthlyEarnings * (0.15 - rate);
  const netGain = feeSavings - price;
  const breakeven = Math.round(price / (0.15 - rate));

  return (
    <main className="plain-surface container" style={{ padding: '72px 32px', maxWidth: 600 }}>
      <span className="eyebrow">Upgrade</span>
      <h1 style={{ fontSize: 42, margin: '16px 0 8px' }}>Stop giving away your margin.</h1>
      <p style={{ color: 'var(--slate)', fontSize: 16, lineHeight: 1.7, marginBottom: 24 }}>
        Standard is 15% per job. Pick the tier that fits how you work.
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        <button
          className={plan === 'pro' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => setPlan('pro')}
          style={{ flex: 1 }}
        >
          Pro — $19/mo, 10%
        </button>
        <button
          className={plan === 'federal_pro' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => setPlan('federal_pro')}
          style={{ flex: 1 }}
        >
          Federal Pro — $29/mo, 8%
        </button>
      </div>

      <div style={{ margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--wood)', fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: 20 }}>—</span>
          <p style={{ margin: 0, fontSize: 15 }}>
            <strong>Platform fee drops to {plan === 'pro' ? '10%' : '8%'}</strong> — down from 15%
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--wood)', fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: 20 }}>—</span>
          <p style={{ margin: 0, fontSize: 15 }}><strong>Priority search placement</strong> — show up first in the directory</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--wood)', fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: 20 }}>—</span>
          <p style={{ margin: 0, fontSize: 15 }}>
            {plan === 'federal_pro'
              ? 'Built for higher-value federal engagements, where 15% adds up fast'
              : 'A Pro badge on your public profile'}
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <p className="meta" style={{ marginBottom: 14 }}>See when this pays for itself</p>
        <label style={{ marginTop: 0 }}>Your typical monthly earnings</label>
        <input
          type="range"
          min="0"
          max="5000"
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
            ? `This plan saves you ~$${netGain.toFixed(0)}/month at this level.`
            : `You'd need about $${breakeven}/month in earnings for this to pay for itself.`}
        </p>
      </div>

      <div style={{ padding: '24px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', marginBottom: 28 }}>
        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 40, fontWeight: 500 }}>${price}</span>
        <span style={{ color: 'var(--slate)', fontSize: 14 }}> / month</span>
        <p style={{ fontSize: 13, color: 'var(--slate)', marginTop: 6 }}>Pays for itself past ~${breakeven}/month in earnings</p>
      </div>

      {error && <p style={{ color: '#b3261e', fontSize: 14, marginBottom: 16 }}>{error}</p>}

      <button className="btn btn-primary" onClick={startSubscribe} disabled={loading}>
        {loading ? 'Redirecting...' : `Upgrade to ${plan === 'pro' ? 'Pro' : 'Federal Pro'}`}
      </button>

      <p style={{ fontSize: 12, color: 'var(--slate)', marginTop: 24 }}>
        No subscription required to join — no credit card needed. See the full breakdown on our{' '}
        <a href="/pricing" style={{ textDecoration: 'underline' }}>pricing page</a>.
      </p>
    </main>
  );
}
