'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ConciergeForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [need, setNeed] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: insertError } = await supabase.from('concierge_requests').insert({
      name,
      email,
      need_description: need,
    });

    if (insertError) {
      setError('Something went wrong — try again, or email us directly.');
      setLoading(false);
      return;
    }

    setSubmitted(true);
    setLoading(false);
  }

  if (submitted) {
    return (
      <div className="concierge-card" style={{ textAlign: 'center' }}>
        <h3 style={{ marginBottom: 8 }}>Request received.</h3>
        <p style={{ fontSize: 14, color: 'var(--slate)' }}>
          We'll reach out with a shortlist of verified candidates within 48 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="concierge-card">
      <label style={{ marginTop: 0 }}>Your name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} required />

      <label>Email</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

      <label>What do you need done?</label>
      <textarea
        value={need}
        onChange={(e) => setNeed(e.target.value)}
        placeholder="e.g. Cleared IT support for a 3-month DoD contract, or a web designer for a rebrand"
        required
      />

      {error && <p style={{ color: '#b3261e', fontSize: 13, marginTop: 10 }}>{error}</p>}

      <button type="submit" className="btn btn-primary" style={{ marginTop: 16, width: '100%' }} disabled={loading}>
        {loading ? 'Sending...' : 'Get a shortlist in 48 hours'}
      </button>
    </form>
  );
}
