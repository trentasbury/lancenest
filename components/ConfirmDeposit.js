'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Shows the client a quote a freelancer sent them. The dollar amount is
// entirely read-only — there is no input field here. Clicking Confirm
// sends only the job's ID to the server; the server looks up the locked
// amount itself. The client cannot influence the number in any way.

export default function ConfirmDeposit({ job }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setLoading(true);
    setError('');

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/checkout-deposit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ jobId: job.id }),
    });
    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      setError(data.error || 'Something went wrong.');
      setLoading(false);
    }
  }

  const quoteDollars = job.quote_cents / 100;
  const depositDollars = (quoteDollars * 0.2).toFixed(0);

  return (
    <div style={{ background: 'var(--marble-dim)', border: '1px solid var(--wood)', borderRadius: 8, padding: 14, marginBottom: 8 }}>
      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{job.title}</p>
      <p style={{ fontSize: 13, marginBottom: 8 }}>
        Quoted: <strong>${quoteDollars.toFixed(0)}</strong> · Deposit to confirm: <strong>${depositDollars}</strong>
      </p>
      {error && <p style={{ fontSize: 12, color: '#b3261e', marginBottom: 8 }}>{error}</p>}
      <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={confirm} disabled={loading}>
        {loading ? 'Redirecting...' : `Confirm with $${depositDollars} deposit`}
      </button>
    </div>
  );
}
