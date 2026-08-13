'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function FreelancerDashboard() {
  const [profile, setProfile] = useState(null);
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [addingWork, setAddingWork] = useState(false);
  const [newWork, setNewWork] = useState({ title: '', description: '', link_url: '' });
  const [trailingEarnings, setTrailingEarnings] = useState(0);
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);

  useEffect(() => {
    // Uses onAuthStateChange as the source of truth instead of a one-off
    // getSession() call — this is the exact pattern that fixed NavBar and
    // ChatWidget earlier. onAuthStateChange fires immediately with the
    // current session the moment it's subscribed to, so nothing extra is
    // needed to get the initial state.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(async () => {
      if (!session) {
        window.location.href = '/login';
        return;
      }

      try {
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        if (!data) {
          setLoading(false);
          return;
        }
        setProfile(data);

        const { data: workData } = await supabase
          .from('portfolio_items')
          .select('*')
          .eq('profile_id', session.user.id)
          .order('created_at', { ascending: false });
        setPortfolio(workData || []);

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentJobs } = await supabase
          .from('jobs')
          .select('amount_cents')
          .eq('freelancer_id', session.user.id)
          .eq('status', 'completed')
          .gte('created_at', thirtyDaysAgo);
        const total = (recentJobs || []).reduce((sum, j) => sum + j.amount_cents, 0);
        setTrailingEarnings(total / 100);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }, 0);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    const { id, headline, bio, hourly_rate, skills, city, state, remote_ok } = profile;
    await supabase
      .from('profiles')
      .update({
        headline,
        bio,
        hourly_rate: hourly_rate ? Number(hourly_rate) : null,
        skills: typeof skills === 'string' ? skills.split(',').map((s) => s.trim()).filter(Boolean) : skills,
        city,
        state,
        remote_ok,
      })
      .eq('id', id);
    setSaving(false);
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    const filePath = `${profile.id}/avatar.${file.name.split('.').pop()}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      alert(uploadError.message);
      setUploadingPhoto(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', profile.id);
    setProfile({ ...profile, avatar_url: avatarUrl });
    setUploadingPhoto(false);
  }

  async function handleCoverUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    const filePath = `${profile.id}/cover.${file.name.split('.').pop()}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      alert(uploadError.message);
      setUploadingCover(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const coverUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase.from('profiles').update({ cover_url: coverUrl }).eq('id', profile.id);
    setProfile({ ...profile, cover_url: coverUrl });
    setUploadingCover(false);
  }

  async function addWorkItem(e) {
    e.preventDefault();
    if (!newWork.title.trim()) return;

    const { data, error } = await supabase
      .from('portfolio_items')
      .insert({
        profile_id: profile.id,
        title: newWork.title,
        description: newWork.description,
        link_url: newWork.link_url || null,
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    setPortfolio([data, ...portfolio]);
    setNewWork({ title: '', description: '', link_url: '' });
    setAddingWork(false);
  }

  async function deleteWorkItem(id) {
    if (!confirm('Remove this from your work?')) return;
    await supabase.from('portfolio_items').delete().eq('id', id);
    setPortfolio(portfolio.filter((p) => p.id !== id));
  }

  async function connectStripe() {
    setConnecting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/stripe-connect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setConnecting(false);
  }

  function startIdmeVerification() {
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_IDME_CLIENT_ID,
      redirect_uri: `${window.location.origin}/api/auth/idme/callback`,
      response_type: 'code',
      scope: 'military',
      state: profile.id,
    });
    window.location.href = `https://api.id.me/oauth/authorize?${params.toString()}`;
  }

  if (loading) return <main className="plain-surface container" style={{ padding: 48 }}>Loading...</main>;

  if (!profile) {
    return (
      <main className="plain-surface container" style={{ padding: 48, textAlign: 'center' }}>
        <p>We couldn't find your profile. Try logging out and back in — if this keeps happening, contact support.</p>
        <a href="/login" className="btn btn-primary" style={{ marginTop: 16 }}>Back to login</a>
      </main>
    );
  }

  return (
    <main className="plain-surface container" style={{ padding: '40px 24px', maxWidth: 560 }}>
      <h1 style={{ fontSize: 26, marginBottom: 24 }}>Your profile</h1>

      {/* Cover photo */}
      <div
        style={{
          height: 140,
          borderRadius: 10,
          marginBottom: -44,
          background: profile.cover_url ? `url(${profile.cover_url}) center/cover` : 'var(--marble-dim)',
          border: '1px solid var(--line)',
          position: 'relative',
        }}
      >
        <input type="file" accept="image/*" ref={coverInputRef} onChange={handleCoverUpload} style={{ display: 'none' }} />
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => coverInputRef.current.click()}
          disabled={uploadingCover}
          style={{ position: 'absolute', bottom: 10, right: 10, background: 'var(--white)', fontSize: 11, padding: '6px 12px' }}
        >
          {uploadingCover ? 'Uploading...' : profile.cover_url ? 'Change cover' : 'Add cover photo'}
        </button>
      </div>

      {/* Avatar, overlapping the cover */}
      <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 2, marginBottom: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              margin: '0 auto 8px',
              background: profile.avatar_url ? `url(${profile.avatar_url}) center/cover` : 'var(--marble-dim)',
              border: '3px solid var(--paper)',
            }}
          />
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoUpload} style={{ display: 'none' }} />
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => fileInputRef.current.click()}
            disabled={uploadingPhoto}
            style={{ fontSize: 11, padding: '6px 12px' }}
          >
            {uploadingPhoto ? 'Uploading...' : profile.avatar_url ? 'Change photo' : 'Add a photo'}
          </button>
        </div>
      </div>

      <div className="card" style={{ margin: '20px 0' }}>
        <h3>Veteran verification</h3>
        <p className="meta">
          {profile.is_veteran_verified
            ? 'Verified through ID.me — your profile shows a Verified Veteran badge.'
            : 'Verify your military or veteran status through ID.me. No documents are ever stored with LanceNest — ID.me confirms your status directly.'}
        </p>
        {!profile.is_veteran_verified && (
          <button className="btn btn-brass" onClick={startIdmeVerification}>Verify with ID.me</button>
        )}
      </div>

      <div className="card" style={{ margin: '20px 0' }}>
        <h3>Payouts</h3>
        <p className="meta">
          {profile.stripe_onboarded
            ? 'Stripe connected — you can receive payments.'
            : 'Connect Stripe to receive payments. Required before clients can hire you.'}
        </p>
        {!profile.stripe_onboarded && (
          <button className="btn btn-brass" onClick={connectStripe} disabled={connecting}>
            {connecting ? 'Redirecting...' : 'Connect Stripe'}
          </button>
        )}
      </div>

      <div className="card" style={{ margin: '20px 0' }}>
        <h3>
          {profile.plan === 'federal_pro' ? 'LanceNest Federal Pro' : profile.plan === 'pro' ? 'LanceNest Pro' : 'Your plan'}
        </h3>
        <p className="meta">
          {profile.plan === 'federal_pro' && "You're on Federal Pro — 8% fee and priority placement."}
          {profile.plan === 'pro' && "You're a Pro member — 10% fee and priority placement."}
          {(!profile.plan || profile.plan === 'standard') && 'Standard — 15% per job, no subscription.'}
        </p>

        {(!profile.plan || profile.plan === 'standard') && trailingEarnings >= 380 && (
          <div style={{ background: 'var(--marble-dim)', border: '1px solid var(--wood)', borderRadius: 8, padding: '12px 14px', margin: '12px 0' }}>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
              You'd have saved ${(trailingEarnings * 0.05 - 19).toFixed(0)} this month on Pro.
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--slate)' }}>
              Based on ${trailingEarnings.toFixed(0)} in completed jobs over the last 30 days.
            </p>
          </div>
        )}

        {(!profile.plan || profile.plan === 'standard') && (
          <a href="/upgrade" className="btn btn-brass">
            {trailingEarnings >= 380 ? 'Upgrade to Pro' : 'See Pro & Federal Pro'}
          </a>
        )}
      </div>

      <h3 style={{ marginTop: 32, marginBottom: 4 }}>Profile details</h3>
      <form onSubmit={saveProfile}>
        <label>Headline</label>
        <input
          value={profile.headline || ''}
          onChange={(e) => setProfile({ ...profile, headline: e.target.value })}
          placeholder="e.g. Shopify developer & brand designer"
        />

        <label>Bio / description</label>
        <textarea
          value={profile.bio || ''}
          onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
          placeholder="Tell clients about your experience and what you do"
        />

        <label>Hourly rate ($)</label>
        <input
          type="number"
          value={profile.hourly_rate || ''}
          onChange={(e) => setProfile({ ...profile, hourly_rate: e.target.value })}
        />

        <label>Skills (comma separated)</label>
        <input
          value={Array.isArray(profile.skills) ? profile.skills.join(', ') : profile.skills || ''}
          onChange={(e) => setProfile({ ...profile, skills: e.target.value })}
          placeholder="Shopify, React, Figma"
        />

        <label>City</label>
        <input value={profile.city || ''} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />

        <label>State</label>
        <select value={profile.state || ''} onChange={(e) => setProfile({ ...profile, state: e.target.value })}>
          <option value="">Select a state</option>
          {['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <input
            type="checkbox"
            checked={profile.remote_ok || false}
            onChange={(e) => setProfile({ ...profile, remote_ok: e.target.checked })}
            style={{ width: 'auto' }}
          />
          Available for remote work
        </label>

        <button type="submit" className="btn btn-primary" style={{ marginTop: 20 }} disabled={saving}>
          {saving ? 'Saving...' : 'Save profile'}
        </button>
      </form>

      {/* Work / portfolio management */}
      <h3 style={{ marginTop: 40, marginBottom: 12 }}>Your work</h3>

      {portfolio.map((item) => (
        <div key={item.id} className="card" style={{ marginBottom: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: 15, marginBottom: 4 }}>{item.title}</h3>
              <p className="meta">{item.description}</p>
              {item.link_url && <a href={item.link_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--wood)' }}>{item.link_url}</a>}
            </div>
            <button
              onClick={() => deleteWorkItem(item.id)}
              style={{ background: 'none', border: 'none', color: '#b3261e', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      {addingWork ? (
        <form onSubmit={addWorkItem} className="card" style={{ marginTop: 12 }}>
          <label style={{ marginTop: 0 }}>Title</label>
          <input
            value={newWork.title}
            onChange={(e) => setNewWork({ ...newWork, title: e.target.value })}
            placeholder="e.g. Brand redesign for a local bakery"
            required
          />
          <label>Description</label>
          <textarea
            value={newWork.description}
            onChange={(e) => setNewWork({ ...newWork, description: e.target.value })}
            placeholder="What did you do, and what was the result?"
          />
          <label>Link (optional)</label>
          <input
            value={newWork.link_url}
            onChange={(e) => setNewWork({ ...newWork, link_url: e.target.value })}
            placeholder="https://..."
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="submit" className="btn btn-primary">Add to profile</button>
            <button type="button" className="btn btn-outline" onClick={() => setAddingWork(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <button className="btn btn-outline" onClick={() => setAddingWork(true)} style={{ marginTop: 12 }}>
          + Add work
        </button>
      )}

      <p style={{ marginTop: 32 }}>
        <a href={`/profile/${profile.id}`} className="btn btn-outline">View public profile</a>
      </p>

      <p style={{ marginTop: 12 }}>
        <a href="/wallet" className="btn btn-outline">View wallet →</a>
      </p>
    </main>
  );
}
