'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ChatWidget() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [otherName, setOtherName] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    init();
  }, []);

  async function loadConversations() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('conversations')
      .select('id, freelancer_id, client_id, created_at, freelancer:profiles!conversations_freelancer_id_fkey(full_name), client:profiles!conversations_client_id_fkey(full_name)')
      .or(`freelancer_id.eq.${user.id},client_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    const withOtherName = (data || []).map((c) => ({
      ...c,
      otherName: c.freelancer_id === user.id ? c.client?.full_name : c.freelancer?.full_name,
    }));

    setConversations(withOtherName);
  }

  async function openConversation(id, name) {
    setActiveId(id);
    setOtherName(name);
    setShowNewChat(false);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/messages/${id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    setMessages(data.messages || []);
  }

  async function searchPeople(query) {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, headline, role')
      .neq('id', user.id)
      .ilike('full_name', `%${query}%`)
      .limit(8);
    setSearchResults(data || []);
    setSearching(false);
  }

  async function startNewChat(otherUserId, name) {
    const { data: { session } } = await supabase.auth.getSession();
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
      setSearchQuery('');
      setSearchResults([]);
      await loadConversations();
      openConversation(data.conversationId, name);
    } else if (data.error) {
      alert(data.error);
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!draft.trim() || !activeId) return;
    setSending(true);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ conversationId: activeId, body: draft }),
    });
    const data = await res.json();

    if (data.message) {
      setMessages((prev) => [...prev, data.message]);
      setDraft('');
    }
    setSending(false);
  }

  useEffect(() => {
    if (open) loadConversations();
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!user) return null;

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 100 }}>
      {open && (
        <div
          style={{
            width: 340,
            height: 460,
            background: 'var(--white)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            boxShadow: '0 20px 50px rgba(26,24,21,0.18)',
            display: 'flex',
            flexDirection: 'column',
            marginBottom: 12,
            overflow: 'hidden',
          }}
        >
          <div style={{ background: 'var(--wood)', color: 'var(--white)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: 18 }}>
              {activeId ? otherName : showNewChat ? 'New message' : 'Messages'}
            </span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {!activeId && !showNewChat && (
                <button
                  onClick={() => setShowNewChat(true)}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 6, color: 'var(--white)', cursor: 'pointer', fontSize: 16, width: 26, height: 26, lineHeight: 1 }}
                  aria-label="New message"
                >
                  +
                </button>
              )}
              {(activeId || showNewChat) && (
                <button onClick={() => { setActiveId(null); setShowNewChat(false); setSearchQuery(''); setSearchResults([]); }} style={{ background: 'none', border: 'none', color: 'var(--white)', cursor: 'pointer', fontSize: 12 }}>
                  ← Back
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--white)', cursor: 'pointer', fontSize: 16 }}>
                ✕
              </button>
            </div>
          </div>

          {showNewChat ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
              <input
                value={searchQuery}
                onChange={(e) => searchPeople(e.target.value)}
                placeholder="Search by name..."
                style={{ marginBottom: 10 }}
                autoFocus
              />
              {searching && <p style={{ fontSize: 12, color: 'var(--slate)' }}>Searching...</p>}
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => startNewChat(p.id, p.full_name)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 8px',
                    border: 'none',
                    borderBottom: '1px solid var(--line)',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: 13.5,
                  }}
                >
                  <strong>{p.full_name}</strong>
                  <div style={{ fontSize: 11, color: 'var(--slate)' }}>{p.headline || (p.role === 'client' ? 'Company' : 'Freelancer')}</div>
                </button>
              ))}
              {searchQuery && !searching && searchResults.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--slate)' }}>No one found.</p>
              )}
            </div>
          ) : !activeId ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
              {conversations.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--slate)', padding: 16, textAlign: 'center' }}>
                  No conversations yet. Tap + to message someone.
                </p>
              )}
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openConversation(c.id, c.otherName)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 10px',
                    border: 'none',
                    borderBottom: '1px solid var(--line)',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  {c.otherName || 'Conversation'}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {messages.length === 0 && <p style={{ fontSize: 12, color: 'var(--slate)' }}>Say hello — no messages yet.</p>}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.sender_id === user.id ? 'flex-end' : 'flex-start',
                      maxWidth: '78%',
                      background: m.sender_id === user.id ? 'var(--wood)' : 'var(--marble-dim)',
                      color: m.sender_id === user.id ? 'var(--white)' : 'var(--ink)',
                      borderRadius: 10,
                      padding: '8px 12px',
                      fontSize: 13.5,
                    }}
                  >
                    {m.body}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={sendMessage} style={{ display: 'flex', gap: 6, padding: 10, borderTop: '1px solid var(--line)', maxWidth: 'none' }}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Message..."
                  style={{ flex: 1, fontSize: 13, padding: '8px 10px' }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 11 }} disabled={sending}>
                  {sending ? '...' : 'Send'}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--wood)',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(26,24,21,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Messages"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
