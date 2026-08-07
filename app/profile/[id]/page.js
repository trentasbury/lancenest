'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import HireButton from './HireButton';
import MessageButton from '../../../components/MessageButton';
import FollowButton from '../../../components/FollowButton';

export default function Profile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [portfolio, setPortfolio] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [authed, setAuthed] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAuthed(false);
        return;
      }
      setAuthed(true);

      const [{ data: profileData }, { data: portfolioData }, { data: reviewsData }, { count: followerCount }, { count: followingCount }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
        supabase.from('portfolio_items').select('*').eq('profile_id', id),
        supabase.from('reviews').select('rating, comment, created_at').eq('reviewee_id', id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', id),
      ]);

      if (!profileData) {
        setNotFound(true);
        return;
      }

      setProfile(profileData);
      setPortfolio(portfolioData || []);
      setReviews(reviewsData || []);
      setCounts({ followers: followerCount || 0, following: followingCount || 0 });
    }
    load();
  }, [id]);

  if (authed === null) return null;

  if (authed === false) {
    return (
      <main className="plain-surface container" style={{ padding: '80px 40px', textAlign: 'center' }}>
        <span className="eyebrow">Members only</span>
        <h1 style={{ fontSize: 32, margin: '14px 0 16px' }}>Log in to view this profile</h1>
        <a href="/login" className="btn btn-primary" style={{ marginRight: 10 }}>Log in</a>
        <a href="/signup" className="btn btn-outline">Create an account</a>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="plain-surface container" style={{ padding: '80px 40px', textAlign: 'center' }}>
        <span className="eyebrow">Not found</span>
        <h1 style={{ fontSize: 28, margin: '14px 0 16px' }}>This profile doesn't exist</h1>
        <p style={{ color: 'var(--slate)', marginBottom: 24 }}>
          It may have been an incomplete signup, or the account no longer exists.
        </p>
        <a href="/directory" className="btn btn-primary">Browse the directory</a>
      </main>
    );
  }

  if (!profile) {
    return <main className="plain-surface container" style={{ padding: 48 }}>Loading...</main>;
  }

  const avgRating = reviews?.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <main className="plain-surface container" style={{ padding: '40px 24px' }}>
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          marginBottom: 16,
          background: profile?.avatar_url ? `url(${profile.avatar_url}) center/cover` : 'var(--marble-dim)',
          border: '1px solid var(--line)',
        }}
      />
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>{profile.full_name}</h1>
      <p style={{ color: 'var(--slate)', marginBottom: 4 }}>{profile.headline}</p>
      <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 8 }}>
        <strong>{counts.followers}</strong> followers · <strong>{counts.following}</strong> following
      </p>
      {avgRating && <p style={{ fontSize: 14 }}>★ {avgRating} ({reviews.length} review{reviews.length !== 1 ? 's' : ''})</p>}
      {profile.role === 'freelancer' && profile.hourly_rate && (
        <p className="rate" style={{ fontSize: 18, marginTop: 8 }}>${profile.hourly_rate}/hr</p>
      )}

      {profile.role === 'freelancer' && (
        <div style={{ margin: '16px 0' }}>
          {profile.skills?.map((s) => <span className="skill-tag" key={s}>{s}</span>)}
        </div>
      )}

      <p style={{ maxWidth: 600, marginBottom: 24 }}>{profile.bio}</p>

      <div style={{ display: 'flex', gap: 10 }}>
        {profile.role === 'freelancer' && (
          <HireButton freelancerId={profile.id} freelancerName={profile.full_name} defaultRate={profile.hourly_rate} />
        )}
        <MessageButton otherUserId={profile.id} />
        <FollowButton targetId={profile.id} />
      </div>

      {portfolio?.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, marginTop: 40 }}>Portfolio</h2>
          <div className="grid" style={{ padding: '16px 0', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))' }}>
            {portfolio.map((p) => (
              <div className="card" key={p.id}>
                <h3>{p.title}</h3>
                <p className="meta">{p.description}</p>
                {p.link_url && <a href={p.link_url} target="_blank" rel="noreferrer">View →</a>}
              </div>
            ))}
          </div>
        </>
      )}

      {reviews?.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, marginTop: 32 }}>Reviews</h2>
          {reviews.map((r, i) => (
            <div key={i} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
              <p style={{ fontWeight: 600 }}>★ {r.rating}</p>
              <p>{r.comment}</p>
            </div>
          ))}
        </>
      )}
    </main>
  );
}
