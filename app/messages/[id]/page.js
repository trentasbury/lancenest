'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function MessageThread() {
  const { id } = useParams();
  const [messages, setMessages] = useState(null);
  const [otherName, setOtherName] = useState('');
  const [userId, setUserId] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  async function loadMessages() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(`/api/messages/${id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    setMessages(data.messages || []);
    setOtherName(data.otherName || 'Conversation');
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }
      setUserId(user.id);
      await loadMessages();
    }
    init();
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ conversationId: id, body: draft }),
    });
    const data = await res.json();

    if (data.message) {
      setMessages((prev) => [...prev, data.message]);
      setDraft('');
    }
    setSending(false);
  }

  if (!messages) return <main className="plain-surface container" style={{ padding: 56 }}>Loading...</main>;

  return (
    <main className="plain-surface" style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
      <div className="container" style={{ padding: '32px 40px 0', maxWidth: 640 }}>
        <a href="/messages" className="meta" style={{ marginBottom: 8, display: 'inline-block' }}>← Messages</a>
        <h1 style={{ fontSize: 26, marginBottom: 8 }}>{otherName}</h1>
        <p className="meta" style={{ marginBottom: 24 }}>🔒 Encrypted — visible only to you and {otherName}</p>
      </div>

      <div className="container" style={{ maxWidth: 640, flex: 1, display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 20 }}>
        {messages.length === 0 && <p className="meta">Say hello — no messages yet.</p>}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.sender_id === userId ? 'flex-end' : 'flex-start',
              maxWidth: '75%',
              background: m.sender_id === userId ? 'var(--wood)' : 'var(--white)',
              color: m.sender_id === userId ? 'var(--white)' : 'var(--ink)',
              border: m.sender_id === userId ? 'none' : '1px solid var(--line)',
              borderRadius: 12,
              padding: '10px 16px',
              fontSize: 15,
              lineHeight: 1.5,
            }}
          >
            {m.body}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="container" style={{ maxWidth: 640, paddingBottom: 32 }}>
        <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8, maxWidth: 'none' }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message..."
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary" disabled={sending} style={{ whiteSpace: 'nowrap' }}>
            {sending ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </main>
  );
}
