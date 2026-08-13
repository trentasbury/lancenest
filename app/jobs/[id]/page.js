'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function JobPage() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [user, setUser] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(async () => {
      const user = session?.user;
      setUser(user);
      const { data } = await supabase.from('jobs').select('*').eq('id', id).single();
      setJob(data);
    }, 0);
    });

    return () => listener.subscription.unsubscribe();
  }, [id]);

  async function markComplete() {
    await supabase.from('jobs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id);
    setJob({ ...job, status: 'completed' });
  }

  async function submitReview(e) {
    e.preventDefault();
    const revieweeId = user.id === job.client_id ? job.freelancer_id : job.client_id;
    await supabase.from('reviews').insert({
      job_id: job.id,
      reviewer_id: user.id,
      reviewee_id: revieweeId,
      rating,
      comment,
    });
    setSubmitted(true);
  }

  if (!job) return <main className="container" style={{ padding: 48 }}>Loading...</main>;

  const commissionDollars = (job.commission_cents / 100).toFixed(2);
  const netDollars = ((job.amount_cents - job.commission_cents) / 100).toFixed(2);

  return (
    <main className="container" style={{ padding: '40px 24px', maxWidth: 480 }}>
      <h1 style={{ fontSize: 26 }}>{job.title}</h1>
      <p className="meta">Status: {job.status}</p>
      <p>Total: ${(job.amount_cents / 100).toFixed(2)}</p>
      <p className="meta">Platform fee: ${commissionDollars} · Freelancer receives: ${netDollars}</p>

      {job.status === 'paid' && (
        <button className="btn btn-primary" onClick={markComplete} style={{ marginTop: 16 }}>
          Mark job complete
        </button>
      )}

      {job.status === 'completed' && !submitted && (
        <form onSubmit={submitReview} style={{ marginTop: 24 }}>
          <h3>Leave a review</h3>
          <label>Rating (1–5)</label>
          <input type="number" min="1" max="5" value={rating} onChange={(e) => setRating(Number(e.target.value))} />
          <label>Comment</label>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} />
          <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }}>Submit review</button>
        </form>
      )}

      {submitted && <p style={{ marginTop: 20 }}>Review submitted. Thanks.</p>}
    </main>
  );
}
