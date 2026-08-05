'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function Wallet() {
  const [jobs, setJobs] = useState(null);
  const [profile, setProfile] = useState(null);
  const [openingDashboard, setOpeningDashboard] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('stripe_onboarded')
        .eq('id', user.id)
        .single();
      setProfile(profileData);

      const { data: jobData } = await supabase
        .from('jobs')
        .select('id, title, amount_cents, commission_cents, status, created_at, completed_at')
        .eq('freelancer_id', user.id)
        .order('created_at', { ascending: false });
      setJobs(jobData || []);
    }
    load();
  }, []);

  async function openStripeDashboard() {
    setOpeningDashboard(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/stripe-dashboard-link', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (data.url) {
      window.open(data.url, '_blank');
    }
    setOpeningDashboard(false);
  }

  if (!jobs) return <main className="plain-surface container" style={{ padding: 56 }}>Loading...</main>;

  const netCents = (job) => job.amount_cents - job.commission_cents;
  const totalEarned = jobs
    .filter((j) => j.status === 'completed')
    .reduce((sum, j) => sum + netCents(j), 0);
  const pending = jobs
    .filter((j) => j.status === 'paid')
    .reduce((sum, j) => sum + netCents(j), 0);

  return (
    <main className="plain-surface" style={{ minHeight: '70vh' }}>
      <div className="container" style={{ padding: '56px 40px', maxWidth: 720 }}>
        <span className="eyebrow">Your earnings</span>
        <h1 style={{ fontSize: 32, margin: '10px 0 32px' }}>Wallet</h1>

        <div style={{ display: 'flex', gap: 1, background: 'var(--line)', marginBottom: 32 }}>
          <div className="card" style={{ flex: 1 }}>
            <p className="meta">Total earned</p>
            <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 600 }}>
              ${(totalEarned / 100).toLocaleString()}
            </p>
          </div>
          <div className="card" style={{ flex: 1 }}>
            <p className="meta">Pending payout</p>
            <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 600 }}>
              ${(pending / 100).toLocaleString()}
            </p>
          </div>
        </div>

        {profile?.stripe_onboarded && (
          <button className="btn btn-outline" onClick={openStripeDashboard} disabled={openingDashboard} style={{ marginBottom: 40 }}>
            {openingDashboard ? 'Opening...' : 'View full payout history on Stripe →'}
          </button>
        )}

        <h3 style={{ marginBottom: 16 }}>Transaction history</h3>

        {jobs.length === 0 && <p className="meta">No jobs yet.</p>}

        {jobs.map((job) => (
          <div key={job.id} className="card" style={{ marginBottom: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h3 style={{ fontSize: 16, marginBottom: 4 }}>{job.title}</h3>
              <p className="meta">
                {new Date(job.created_at).toLocaleDateString()} · {job.status}
              </p>
            </div>
            <p className="rate" style={{ fontSize: 16 }}>
              ${(netCents(job) / 100).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
