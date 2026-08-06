'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function Listings() {
  const [listings, setListings] = useState(null);
  const [authed, setAuthed] = useState(null);
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAuthed(false);
        const { data } = await supabase.rpc('get_platform_counts');
        setCounts(data?.[0] || null);
        return;
      }
      setAuthed(true);

      const { data } = await supabase
        .from('job_listings')
        .select('id, title, description, budget_cents, skills, created_at, profiles(full_name)')
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      setListings(data || []);
    }
    load();
  }, []);

  if (authed === null) return null;

  if (authed === false) {
    const count = counts?.open_listing_count;
    return (
      <main className="plain-surface container" style={{ padding: '80px 40px', textAlign: 'center' }}>
        <span className="eyebrow">Members only</span>
        <h1 style={{ fontSize: 32, margin: '14px 0 16px' }}>
          {typeof count === 'number' && count > 0
            ? `${count} open job${count === 1 ? '' : 's'} right now`
            : 'Log in to browse jobs'}
        </h1>
        <p style={{ color: 'var(--slate)', marginBottom: 28 }}>
          Create a free account to see and apply to open work — takes under a minute.
        </p>
        <a href="/login" className="btn btn-primary" style={{ marginRight: 10 }}>Log in</a>
        <a href="/signup" className="btn btn-outline">Create a free account</a>
      </main>
    );
  }

  return (
    <main className="plain-surface" style={{ minHeight: '60vh' }}>
      <div className="container" style={{ padding: '56px 40px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <span className="eyebrow">Open work</span>
          <h1 style={{ fontSize: 34, marginTop: 10 }}>Job listings</h1>
        </div>
        <a href="/listings/new" className="pill-btn">Post a job</a>
      </div>

      {listings && listings.length === 0 && (
        <div className="empty">No open listings yet — be the first to post one.</div>
      )}

      <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', padding: 1, marginBottom: 60 }}>
        {listings?.map((listing) => (
          <a
            key={listing.id}
            href={`/listings/${listing.id}`}
            className="card"
            style={{ display: 'block' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>{listing.title}</h3>
                <p className="meta" style={{ marginBottom: 10 }}>
                  Posted by {listing.profiles?.full_name || 'A client'}
                </p>
              </div>
              {listing.budget_cents && (
                <p className="rate" style={{ fontSize: 15 }}>
                  ${(listing.budget_cents / 100).toLocaleString()}
                </p>
              )}
            </div>
            <p style={{ color: 'var(--slate)', fontSize: 15, lineHeight: 1.6, margin: '8px 0 12px' }}>
              {listing.description?.slice(0, 160)}{listing.description?.length > 160 ? '…' : ''}
            </p>
            <div>
              {listing.skills?.slice(0, 5).map((s) => (
                <span className="skill-tag" key={s}>{s}</span>
              ))}
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
