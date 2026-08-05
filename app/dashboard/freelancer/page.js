'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function FreelancerDashboard() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(data);
      setLoading(false);
    }
    load();
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    const { id, headline, bio, hourly_rate, skills } = profile;
    await supabase
      .from('profiles')
      .update({
        headline,
        bio,
        hourly_rate: hourly_rate ? Number(hourly_rate) : null,
        skills: typeof skills === 'string' ? skills.split(',').map((s) => s.trim()).filter(Boolean) : skills,
      })
      .eq('id', id);
    setSaving(false);
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

  if (loading) return <main className="container" style={{ padding: 48 }}>Loading...</main>;

  return (
    <main className="container" style={{ padding: '40px 24px', maxWidth: 480 }}>
      <h1 style={{ fontSize: 26 }}>Your profile</h1>

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
        <h3>{profile.is_pro ? 'LanceNest Pro' : 'Get seen first'}</h3>
        <p className="meta">
          {profile.is_pro
            ? 'You\'re a Pro member — your profile shows first in the directory.'
            : 'Upgrade to Pro for priority placement in the directory, $15/month. Same 10% fee either way.'}
        </p>
        {!profile.is_pro && (
          <a href="/upgrade" className="btn btn-brass">Upgrade to Pro</a>
        )}
      </div>

      <form onSubmit={saveProfile}>
        <label>Headline</label>
        <input
          value={profile.headline || ''}
          onChange={(e) => setProfile({ ...profile, headline: e.target.value })}
          placeholder="e.g. Shopify developer & brand designer"
        />

        <label>Bio</label>
        <textarea
          value={profile.bio || ''}
          onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
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

        <button type="submit" className="btn btn-primary" style={{ marginTop: 20 }} disabled={saving}>
          {saving ? 'Saving...' : 'Save profile'}
        </button>
      </form>

      <p style={{ marginTop: 24 }}>
        <a href={`/profile/${profile.id}`} className="btn btn-outline">View public profile</a>
      </p>
    </main>
  );
}
