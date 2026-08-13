'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function Messages() {
  const [conversations, setConversations] = useState(null);
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(async () => {
      const user = session?.user;
      if (!user) {
        setAuthed(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('conversations')
          .select('id, freelancer_id, client_id, created_at, freelancer:profiles!conversations_freelancer_id_fkey(full_name), client:profiles!conversations_client_id_fkey(full_name)')
          .or(`freelancer_id.eq.${user.id},client_id.eq.${user.id}`)
          .order('created_at', { ascending: false });

        const withOtherName = (data || []).map((c) => ({
          ...c,
          otherName: c.freelancer_id === user.id ? c.client?.full_name : c.freelancer?.full_name,
        }));

        setAuthed(true);
        setConversations(withOtherName);
      } catch (err) {
        console.error('Messages load error:', err);
        setAuthed(true);
      }
    }, 0);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (authed === null) return null;

  if (authed === false) {
    return (
      <main className="plain-surface container" style={{ padding: '80px 40px', textAlign: 'center' }}>
        <span className="eyebrow">Members only</span>
        <h1 style={{ fontSize: 32, margin: '14px 0 16px' }}>Log in to view your messages</h1>
        <a href="/login" className="btn btn-primary">Log in</a>
      </main>
    );
  }

  return (
    <main className="plain-surface" style={{ minHeight: '70vh' }}>
      <div className="container" style={{ padding: '56px 40px', maxWidth: 640 }}>
        <span className="eyebrow">Encrypted, on-site messaging</span>
        <h1 style={{ fontSize: 32, margin: '10px 0 32px' }}>Messages</h1>

        {conversations && conversations.length === 0 && (
          <p className="meta">No conversations yet. Message someone from their profile or a job listing.</p>
        )}

        {conversations?.map((c) => (
          <a key={c.id} href={`/messages/${c.id}`} className="card" style={{ display: 'block', marginBottom: 1 }}>
            <h3 style={{ fontSize: 17 }}>{c.otherName || 'Conversation'}</h3>
            <p className="meta">Started {new Date(c.created_at).toLocaleDateString()}</p>
          </a>
        ))}
      </div>
    </main>
  );
}
