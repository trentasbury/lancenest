'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function NewListing() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [skills, setSkills] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data: { session } } = await supabase.auth.getSession();

    const user = session?.user;
    if (!user) {
      setError('Log in as a client to post a job.');
      setLoading(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from('job_listings')
      .insert({
        client_id: user.id,
        title,
        description,
        budget_cents: budget ? Math.round(Number(budget) * 100) : null,
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push(`/listings/${data.id}`);
  }

  return (
    <main className="plain-surface" style={{ minHeight: '60vh' }}>
      <div className="container" style={{ padding: '56px 40px', maxWidth: 560 }}>
        <span className="eyebrow">Post a job</span>
        <h1 style={{ fontSize: 32, margin: '10px 0 30px' }}>Describe what you need done</h1>

        <form onSubmit={handleSubmit}>
          <label>Job title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Shopify theme redesign" />

          <label>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} required style={{ minHeight: 140 }} />

          <label>Budget ($, optional)</label>
          <input type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 1500" />

          <label>Skills needed (comma separated)</label>
          <input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Shopify, Liquid, CSS" />

          {error && <p style={{ color: '#b3261e', fontSize: 14, marginTop: 12 }}>{error}</p>}

          <button type="submit" className="btn btn-primary" style={{ marginTop: 24 }} disabled={loading}>
            {loading ? 'Posting...' : 'Post listing'}
          </button>
        </form>
      </div>
    </main>
  );
}
