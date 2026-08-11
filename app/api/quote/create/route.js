'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Lets a freelancer send a locked quote to the client they're chatting with.
// The client only ever sees a fixed number to confirm — never an editable one.

export default function SendQuote({ clientId, onSent }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function submitQuote(e) {
    e.preventDefault();
    setSending(true);
    setError('');

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/quote/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ clientId, title, quoteDollars: Number(amount) }),
    });
    const data = await res.json();

    if (data.job) {
      setOpen(false);
      setTitle('');
      setAmount('');
      if (onSent) onSent(data.job);
    } else {
      setError(data.error || 'Something went wrong.');
    }
    setSending(false);
  }

  if (!open) {
    return (
      <button className="btn btn-outline" style={{ fontSize: 11, padding: '6px 12px' }} onClick={() => setOpen(true)}>
        Send a quote
      </button>
    );
  }

  return (
    <form onSubmit={submitQuote} style={{ background: 'var(--marble-dim)', border: '1px solid var(--line)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What's the job? (e.g. AC repair)"
        style={{ marginBottom: 8, fontSize: 13 }}
        required
      />
      <input
        type="number"
        min="1"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Quote amount ($)"
        style={{ marginBottom: 8, fontSize: 13 }}
        required
      />
      {amount > 0 && (
        <p style={{ fontSize: 11, color: 'var(--slate)', marginBottom: 8 }}>
          Client confirms with a ${(amount * 0.2).toFixed(0)} deposit (20%) — locked, they can't change this.
        </p>
      )}
      {error && <p style={{ fontSize: 12, color: '#b3261e', marginBottom: 8 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="submit" className="btn btn-primary" style={{ fontSize: 11, padding: '6px 12px' }} disabled={sending}>
          {sending ? 'Sending...' : 'Send locked quote'}
        </button>
        <button type="button" className="btn btn-outline" style={{ fontSize: 11, padding: '6px 12px' }} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
