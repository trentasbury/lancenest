'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function Network() {
  const [authed, setAuthed] = useState(null);
  const [tab, setTab] = useState('feed');
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [feed, setFeed] = useState([]);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(async () => {
      const user = session?.user;
      if (!user) {
        setAuthed(false);
        return;
      }

      try {
        const { data: followingRows } = await supabase
          .from('follows')
          .select('following_id, profiles!follows_following_id_fkey(id, full_name, headline, role, avatar_url)')
          .eq('follower_id', user.id);

        const { data: followerRows } = await supabase
          .from('follows')
          .select('follower_id, profiles!follows_follower_id_fkey(id, full_name, headline, role, avatar_url)')
          .eq('following_id', user.id);

        setAuthed(true);
        setFollowing((followingRows || []).map((r) => r.profiles));
        setFollowers((followerRows || []).map((r) => r.profiles));

        const followingIds = (followingRows || []).map((r) => r.following_id);

        if (followingIds.length > 0) {
          const [{ data: portfolioItems }, { data: listings }] = await Promise.all([
            supabase
              .from('portfolio_items')
              .select('id, title, description, link_url, created_at, profiles(id, full_name, avatar_url)')
              .in('profile_id', followingIds)
              .order('created_at', { ascending: false })
              .limit(20),
            supabase
              .from('job_listings')
              .select('id, title, description, budget_cents, created_at, status, profiles(id, full_name, avatar_url)')
              .in('client_id', followingIds)
              .eq('status', 'open')
              .order('created_at', { ascending: false })
              .limit(20),
          ]);

          const combined = [
            ...(portfolioItems || []).map((p) => ({ ...p, type: 'portfolio' })),
            ...(listings || []).map((l) => ({ ...l, type: 'listing' })),
          ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

          setFeed(combined);
        }
      } catch (err) {
        console.error('Network load error:', err);
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
        <h1 style={{ fontSize: 32, margin: '14px 0 16px' }}>Log in to view your network</h1>
        <a href="/login" className="btn btn-primary">Log in</a>
      </main>
    );
  }

  return (
    <main className="plain-surface" style={{ minHeight: '70vh' }}>
      <div className="container" style={{ padding: '56px 40px', maxWidth: 680 }}>
        <span className="eyebrow">Your network</span>
        <h1 style={{ fontSize: 32, margin: '10px 0 24px' }}>Network</h1>

        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          <button className={tab === 'feed' ? 'btn btn-primary' : 'btn btn-outline'} onClick={() => setTab('feed')}>Feed</button>
          <button className={tab === 'following' ? 'btn btn-primary' : 'btn btn-outline'} onClick={() => setTab('following')}>Following ({following.length})</button>
          <button className={tab === 'followers' ? 'btn btn-primary' : 'btn btn-outline'} onClick={() => setTab('followers')}>Followers ({followers.length})</button>
        </div>

        {tab === 'feed' && (
          <>
            {feed.length === 0 && (
              <p className="meta">
                Nothing yet — follow freelancers to see their work, or follow companies to see when they post new jobs.
              </p>
            )}
            {feed.map((item) => (
              <div key={`${item.type}-${item.id}`} className="card" style={{ marginBottom: 1 }}>
                <p className="meta" style={{ marginBottom: 6 }}>
                  <a href={`/profile/${item.profiles?.id}`}>{item.profiles?.full_name}</a>
                  {item.type === 'portfolio' ? ' added new work' : ' posted a job'}
                </p>
                <h3 style={{ fontSize: 17, marginBottom: 4 }}>{item.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--slate)', marginBottom: 10 }}>
                  {item.description?.slice(0, 140)}{item.description?.length > 140 ? '…' : ''}
                </p>
                {item.type === 'portfolio' && item.link_url && (
                  <a href={item.link_url} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ fontSize: 11 }}>View work →</a>
                )}
                {item.type === 'listing' && (
                  <a href={`/listings/${item.id}`} className="btn btn-primary" style={{ fontSize: 11 }}>View & apply →</a>
                )}
              </div>
            ))}
          </>
        )}

        {tab === 'following' && (
          <>
            {following.length === 0 && <p className="meta">You're not following anyone yet.</p>}
            {following.map((p) => (
              <a href={`/profile/${p.id}`} key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 1 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: p.avatar_url ? `url(${p.avatar_url}) center/cover` : 'var(--marble-dim)', flexShrink: 0 }} />
                <div>
                  <h3 style={{ fontSize: 15 }}>{p.full_name}</h3>
                  <p className="meta">{p.headline || (p.role === 'client' ? 'Company' : 'Freelancer')}</p>
                </div>
              </a>
            ))}
          </>
        )}

        {tab === 'followers' && (
          <>
            {followers.length === 0 && <p className="meta">No followers yet.</p>}
            {followers.map((p) => (
              <a href={`/profile/${p.id}`} key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 1 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: p.avatar_url ? `url(${p.avatar_url}) center/cover` : 'var(--marble-dim)', flexShrink: 0 }} />
                <div>
                  <h3 style={{ fontSize: 15 }}>{p.full_name}</h3>
                  <p className="meta">{p.headline || (p.role === 'client' ? 'Company' : 'Freelancer')}</p>
                </div>
              </a>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
