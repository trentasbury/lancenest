'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

// Set this to your own account's email — only you can access this page.
const ADMIN_EMAIL = 'trent.asbury18@gmail.com';

export default function AdminApprovals() {
  const [isAdmin, setIsAdmin] = useState(null);
  const [pendingFreelancers, setPendingFreelancers] = useState(null);
  const [pendingClients, setPendingClients] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.email !== ADMIN_EMAIL) {
        setIsAdmin(false);
        return;
      }
      setIsAdmin(true);

      const [{ data: freelancers }, { data: clients }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, headline, bio, skills, is_veteran_verified, created_at')
          .eq('role', 'freelancer')
          .eq('is_approved', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, full_name, email, company_name, company_website, created_at')
          .eq('role', 'client')
          .eq('is_approved', false)
          .order('created_at', { ascending: false }),
      ]);

      setPendingFreelancers(freelancers || []);
      setPendingClients(clients || []);
    }
    load();
  }, []);

  async function approve(id, isClient) {
    await supabase.from('profiles').update({ is_approved: true }).eq('id', id);
    if (isClient) {
      setPendingClients((prev) => prev.filter((p) => p.id !== id));
    } else {
      setPendingFreelancers((prev) => prev.filter((p) => p.id !== id));
    }
  }

  async function reject(id, isClient) {
    if (!confirm('Delete this profile permanently?')) return;
    await supabase.from('profiles').delete().eq('id', id);
    if (isClient) {
      setPendingClients((prev) => prev.filter((p) => p.id !== id));
    } else {
      setPendingFreelancers((prev) => prev.filter((p) => p.id !== id));
    }
  }

  if (isAdmin === null) return null;
  if (isAdmin === false) {
    return <main className="plain-surface container" style={{ padding: 56 }}>Not authorized.</main>;
  }

  return (
    <main className="plain-surface" style={{ minHeight: '70vh' }}>
      <div className="container" style={{ padding: '56px 40px', maxWidth: 700 }}>
        <span className="eyebrow">Admin</span>
        <h1 style={{ fontSize: 32, margin: '10px 0 8px' }}>Pending approvals</h1>
        <p className="meta" style={{ marginBottom: 32 }}>
          Freelancers are veteran-verified via ID.me separately. Companies are reviewed manually here before they can post jobs.
        </p>

        <h2 style={{ fontSize: 20, marginBottom: 16 }}>Freelancers ({pendingFreelancers?.length ?? '…'})</h2>
        {pendingFreelancers && pendingFreelancers.length === 0 && <p className="meta" style={{ marginBottom: 32 }}>Nothing waiting on review.</p>}
        {pendingFreelancers?.map((p) => (
          <div key={p.id} className="card" style={{ marginBottom: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: 18 }}>{p.full_name}</h3>
              {p.is_veteran_verified && (
                <span style={{ fontSize: 11, color: 'var(--wood)', fontWeight: 600 }}>✓ ID.me Verified</span>
              )}
            </div>
            <p className="meta">{p.email}</p>
            <p className="meta" style={{ marginTop: 4 }}>{p.headline}</p>
            {p.bio && <p style={{ fontSize: 14, marginTop: 8, color: 'var(--slate)' }}>{p.bio}</p>}
            <div style={{ marginTop: 8 }}>
              {p.skills?.map((s) => <span className="skill-tag" key={s}>{s}</span>)}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => approve(p.id, false)}>Approve</button>
              <button className="btn btn-outline" onClick={() => reject(p.id, false)}>Reject &amp; delete</button>
            </div>
          </div>
        ))}

        <h2 style={{ fontSize: 20, margin: '40px 0 16px' }}>Companies ({pendingClients?.length ?? '…'})</h2>
        {pendingClients && pendingClients.length === 0 && <p className="meta">Nothing waiting on review.</p>}
        {pendingClients?.map((c) => (
          <div key={c.id} className="card" style={{ marginBottom: 1 }}>
            <h3 style={{ fontSize: 18 }}>{c.company_name || c.full_name}</h3>
            <p className="meta">{c.full_name} · {c.email}</p>
            {c.company_website && (
              <p style={{ fontSize: 13, marginTop: 4 }}>
                <a href={c.company_website} target="_blank" rel="noreferrer" style={{ color: 'var(--wood)' }}>
                  {c.company_website}
                </a>
              </p>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => approve(c.id, true)}>Approve</button>
              <button className="btn btn-outline" onClick={() => reject(c.id, true)}>Reject &amp; delete</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
