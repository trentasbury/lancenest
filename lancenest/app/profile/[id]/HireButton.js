'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function HireButton({ freelancerId, freelancerName, defaultRate }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState(defaultRate || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function startCheckout(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Log in as a client to hire.');
      setLoading(false);
      return;
    }

    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ freelancerId, title, amountDollars: Number(amount) }),
    });

    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setError(data.error || 'Something went wrong.');
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button className="btn btn-brass" onClick={() => setOpen(true)}>
        Hire {freelancerName.split(' ')[0]}
      </button>
    );
  }

  return (
    <form onSubmit={startCheckout} style={{ maxWidth: 360 }}>
      <label>Job title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Landing page redesign" />

      <label>Amount ($)</label>
      <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />

      {error && <p style={{ color: '#b3261e', fontSize: 14, marginTop: 10 }}>{error}</p>}

      <button type="submit" className="btn btn-brass" style={{ marginTop: 16 }} disabled={loading}>
        {loading ? 'Redirecting to payment...' : 'Continue to payment'}
      </button>
    </form>
  );
}
