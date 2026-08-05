'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function MessageButton({ otherUserId, label = 'Message' }) {
  const [loading, setLoading] = useState(false);

  async function startConversation() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = '/login';
      return;
    }

    const res = await fetch('/api/messages/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ otherUserId }),
    });
    const data = await res.json();

    if (data.conversationId) {
      window.location.href = `/messages/${data.conversationId}`;
    }
    setLoading(false);
  }

  return (
    <button className="btn btn-outline" onClick={startConversation} disabled={loading}>
      {loading ? '...' : label}
    </button>
  );
}
