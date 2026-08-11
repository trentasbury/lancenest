'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const FOUNDING_CAP = 20;

export default function FoundingBanner() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.rpc('get_platform_counts');
      setCount(data?.[0]?.freelancer_count ?? 0);
    }
    load();
  }, []);

  const claimed = Math.min(count ?? 0, FOUNDING_CAP);
  const percent = (claimed / FOUNDING_CAP) * 100;
  const spotsLeft = Math.max(FOUNDING_CAP - claimed, 0);

  return (
    <section className="marble-surface founding-banner">
      <span className="eyebrow">Founding 20</span>
      <h2 style={{ fontSize: 32, margin: '14px 0 8px' }}>
        We're building the first 20 verified profiles.
      </h2>
      <p style={{ color: 'var(--slate)', maxWidth: 480, margin: '0 auto 20px' }}>
        Join as a Founding Member and your profile is one of the first federal
        contractors and companies see — before the directory fills in.
      </p>

      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <p style={{ fontSize: 13, color: 'var(--wood)', fontWeight: 600, marginBottom: 24 }}>
        {count === null ? '—' : `${claimed}/${FOUNDING_CAP} spots claimed · ${spotsLeft} left`}
      </p>

      <a href="/signup?role=freelancer" className="btn btn-primary">Claim a Founding spot</a>
    </section>
  );
}
