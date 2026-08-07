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
  const [stats, setStats] = useState({ earnedCents: 0, hiredCount: 0 });
  const [tab, setTab] = useState('work');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAuthed(false);
        return;
      }
      setAuthed(true);

      const [
        { data: profileData },
        { data: portfolioData },
        { data: reviewsData },
        { count: followerCount },
        { count: followingCount },
        { data: completedJobs },
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
        supabase.from('portfolio_items').select('*').eq('profile_id', id),
        supabase.from('reviews').select('rating, comment, created_at').eq('reviewee_id', id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', id),
        supabase.from('jobs').select('amount_cents, commission_cents').eq('freelancer_id', id).eq('status', 'completed'),
      ]);

      if (!profileData) {
        setNotFound(true);
        return;
      }

      const earnedCents = (completedJobs || []).reduce((sum, j) => sum + (j.amount_cents - j.commission_cents), 0);

      setProfile(profileData);
      setPortfolio(portfolioData || []);
      setReviews(reviewsData || []);
      setCounts({ followers: followerCount || 0, following: followingCount || 0 });
      setStats({ earnedCents, hiredCount: (completedJobs || []).length });
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

  const isFreelancer = profile.role === 'freelancer';

  return (
    <main className="plain-surface container" style={{ padding: '40px 24px', maxWidth: 780 }}>
      <div className="profile-header">
        <div className="profile-avatar-wrap">
          <div
            className="profile-avatar"
            style={{ background: profile.avatar_url ? `url(${profile.avatar_url}) center/cover` : 'var(--marble-dim)' }}
          />
          {profile.is_pro && <span className="profile-pro-badge">PRO</span>}
        </div>

        <div className="profile-name-block" style={{ flex: 1, minWidth: 220 }}>
          <h1>{profile.full_name}</h1>
          <p className="headline">{profile.headline || (isFreelancer ? 'Freelancer on LanceNest' : 'Company on LanceNest')}</p>

          <div className="profile-actions">
            {isFreelancer && (
              <HireButton freelancerId={profile.id} freelancerName={profile.full_name} defaultRate={profile.hourly_rate} />
            )}
            <MessageButton otherUserId={profile.id} />
            <FollowButton targetId={profile.id} />
          </div>
        </div>
      </div>

      <div className="profile-stats">
        {isFreelancer && (
          <div className="profile-stat">
            <strong>${(stats.earnedCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
            <span>Earned</span>
          </div>
        )}
        {isFreelancer && (
          <div className="profile-stat">
            <strong>{stats.hiredCount}×</strong>
            <span>Hired</span>
          </div>
        )}
        <div className="profile-stat">
          <strong>{avgRating ? `★ ${avgRating}` : '—'}</strong>
          <span>Rating</span>
        </div>
        <div className="profile-stat">
          <strong>{counts.followers}</strong>
          <span>Followers</span>
        </div>
        <div className="profile-stat">
          <strong>{counts.following}</strong>
          <span>Following</span>
        </div>
      </div>

      {isFreelancer && (profile.skills?.length > 0 || profile.hourly_rate) && (
        <div className="profile-badges">
          {profile.hourly_rate && <span className="profile-badge">${profile.hourly_rate}/hr</span>}
          {profile.skills?.map((s) => <span className="profile-badge" key={s}>{s}</span>)}
        </div>
      )}

      <div className="profile-tabs">
        <button className={`profile-tab ${tab === 'work' ? 'active' : ''}`} onClick={() => setTab('work')}>Work</button>
        <button className={`profile-tab ${tab === 'reviews' ? 'active' : ''}`} onClick={() => setTab('reviews')}>Reviews ({reviews.length})</button>
        <button className={`profile-tab ${tab === 'about' ? 'active' : ''}`} onClick={() => setTab('about')}>About</button>
      </div>

      {tab === 'work' && (
        <>
          {portfolio.length === 0 && <p className="meta">No work added yet.</p>}
          <div className="portfolio-grid-v2">
            {portfolio.map((p) => (
              <div className="portfolio-card" key={p.id}>
                <h3>{p.title}</h3>
                <p className="meta" style={{ marginBottom: 10 }}>{p.description}</p>
                {p.link_url && <a href={p.link_url} target="_blank" rel="noreferrer" style={{ color: 'var(--wood)', fontSize: 13 }}>View work →</a>}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'reviews' && (
        <>
          {reviews.length === 0 && <p className="meta">No reviews yet.</p>}
          {reviews.map((r, i) => (
            <div key={i} style={{ borderBottom: '1px solid var(--line)', padding: '16px 0' }}>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>★ {r.rating}</p>
              <p style={{ color: 'var(--slate)', fontSize: 14.5 }}>{r.comment}</p>
            </div>
          ))}
        </>
      )}

      {tab === 'about' && (
        <p style={{ maxWidth: 600, lineHeight: 1.8, color: 'var(--slate)' }}>
          {profile.bio || 'No bio added yet.'}
        </p>
      )}
    </main>
  );
}
