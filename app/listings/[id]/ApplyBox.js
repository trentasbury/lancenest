'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function ApplyBox({ listingId, clientId }) {
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase
          .from('job_applications')
          .select('id')
          .eq('listing_id', listingId)
          .eq('freelancer_id', user.id)
          .maybeSingle();
        if (data) setApplied(true);
      }
      setChecking(false);
    }
    load();
  }, [listingId]);

  async function submitApplication(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: insertError } = await supabase.from('job_applications').insert({
      listing_id: listingId,
      freelancer_id: user.id,
      message,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setApplied(true);
    setLoading(false);
  }

  if (checking) return null;

  if (!user) {
    return (
      <div className="card">
        <p className="meta">Log in as a freelancer to apply.</p>
        <a href="/login" className="btn btn-outline" style={{ marginTop: 12 }}>Log in</a>
      </div>
    );
  }

  if (user.id === clientId) {
    return null;
  }

  if (applied) {
    return (
      <div className="card">
        <p className="meta">You've applied to this listing. The client will reach out if it's a fit.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 12 }}>Apply to this job</h3>
      <form onSubmit={submitApplication}>
        <label>Why you're a fit (optional)</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} style={{ minHeight: 100 }} />
        {error && <p style={{ color: '#b3261e', fontSize: 14, marginTop: 10 }}>{error}</p>}
        <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }} disabled={loading}>
          {loading ? 'Submitting...' : 'Submit application'}
        </button>
      </form>
    </div>
  );
}
