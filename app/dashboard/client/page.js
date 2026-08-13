'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function ClientDashboard() {
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState(null);
  const [applicationCounts, setApplicationCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(async () => {
      if (!session) {
        window.location.href = '/login';
        return;
      }
      const user = session.user;

      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (!profileData) {
          setLoading(false);
          return;
        }
        setProfile(profileData);

        const { data: listingData } = await supabase
          .from('job_listings')
          .select('id, title, status, budget_cents, created_at')
          .eq('client_id', user.id)
          .order('created_at', { ascending: false });
        setListings(listingData || []);

        if (listingData?.length) {
          const counts = {};
          for (const listing of listingData) {
            const { count } = await supabase
              .from('job_applications')
              .select('id', { count: 'exact', head: true })
              .eq('listing_id', listing.id);
            counts[listing.id] = count || 0;
          }
          setApplicationCounts(counts);
        }
      } catch (err) {
        console.error('Client dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }, 0);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function toggleStatus(listingId, currentStatus) {
    const newStatus = currentStatus === 'open' ? 'closed' : 'open';
    await supabase.from('job_listings').update({ status: newStatus }).eq('id', listingId);
    setListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, status: newStatus } : l)));
  }

  if (loading) return <main className="plain-surface container" style={{ padding: 56 }}>Loading...</main>;

  if (!profile) {
    return (
      <main className="plain-surface container" style={{ padding: 48, textAlign: 'center' }}>
        <p>We couldn't find your profile. Try logging out and back in — if this keeps happening, contact support.</p>
        <a href="/login" className="btn btn-primary" style={{ marginTop: 16 }}>Back to login</a>
      </main>
    );
  }

  return (
    <main className="plain-surface" style={{ minHeight: '70vh' }}>
      <div className="container" style={{ padding: '56px 40px', maxWidth: 720 }}>
        <span className="eyebrow">Company dashboard</span>
        <h1 style={{ fontSize: 32, margin: '10px 0 6px' }}>{profile?.company_name || profile?.full_name}</h1>
        {!profile?.is_approved && (
          <div className="card" style={{ marginBottom: 20, borderColor: 'var(--wood)' }}>
            <p style={{ fontSize: 14 }}>
              Your account is pending a quick manual review — this usually happens fast. Once approved, your job posts will appear publicly to veteran freelancers.
            </p>
          </div>
        )}
        <p className="meta" style={{ marginBottom: 32 }}>{profile?.email}</p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 40 }}>
          <a href="/listings/new" className="btn btn-primary">Post a new job</a>
          <a href="/directory" className="btn btn-outline">Browse freelancers</a>
          <a href="/messages" className="btn btn-outline">Messages</a>
        </div>

        <h3 style={{ marginBottom: 16 }}>Your job listings</h3>

        {listings.length === 0 && (
          <p className="meta">You haven't posted any jobs yet.</p>
        )}

        {listings.map((listing) => (
          <div key={listing.id} className="card" style={{ marginBottom: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <a href={`/listings/${listing.id}`}>
                  <h3 style={{ fontSize: 17, marginBottom: 4 }}>{listing.title}</h3>
                </a>
                <p className="meta">
                  {applicationCounts[listing.id] || 0} applicant{applicationCounts[listing.id] === 1 ? '' : 's'} ·{' '}
                  <span style={{ color: listing.status === 'open' ? 'var(--wood)' : 'var(--slate)' }}>
                    {listing.status}
                  </span>
                </p>
              </div>
              <button
                className="btn btn-outline"
                style={{ padding: '8px 16px', fontSize: 11 }}
                onClick={() => toggleStatus(listing.id, listing.status)}
              >
                Mark {listing.status === 'open' ? 'closed' : 'open'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
