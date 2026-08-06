'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

function DirectoryContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [freelancers, setFreelancers] = useState(null);
  const [authed, setAuthed] = useState(null);
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setAuthed(false);
        const { data } = await supabase.rpc('get_platform_counts');
        setCounts(data?.[0] || null);
        return;
      }
      setAuthed(true);

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, headline, skills, hourly_rate, is_pro')
        .eq('role', 'freelancer')
        .order('is_pro', { ascending: false })
        .order('created_at', { ascending: false });

      setFreelancers(data || []);
    }
    load();
  }, [query]);

  if (authed === null) return null;

  if (authed === false) {
    const count = counts?.freelancer_count;
    return (
      <main className="plain-surface container" style={{ padding: '80px 40px', textAlign: 'center' }}>
        <span className="eyebrow">Members only</span>
        <h1 style={{ fontSize: 32, margin: '14px 0 16px' }}>
          {typeof count === 'number' && count > 0
            ? `${count} freelancer${count === 1 ? '' : 's'} waiting to be found`
            : 'Log in to browse talent'}
        </h1>
        <p style={{ color: 'var(--slate)', marginBottom: 28 }}>
          {query
            ? `Log in to see who matches "${query}".`
            : 'Create a free account to browse the full directory — takes under a minute.'}
        </p>
        <a href="/login" className="btn btn-primary" style={{ marginRight: 10 }}>Log in</a>
        <a href="/signup" className="btn btn-outline">Create a free account</a>
      </main>
    );
  }

  return (
    <main className="plain-surface">
      <div className="section-title" style={{ paddingTop: 32 }}>Find talent</div>
      {freelancers && freelancers.length === 0 && (
        <div className="empty">No freelancers yet — be the first to create a profile.</div>
      )}
      <div className="grid">
        {freelancers?.map((f) => (
          <a href={`/profile/${f.id}`} key={f.id} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <h3 style={{ margin: 0 }}>{f.full_name}</h3>
              {f.is_pro && (
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    color: 'var(--white)',
                    background: 'var(--wood)',
                    padding: '2px 7px',
                    borderRadius: 3,
                  }}
                >
                  VERIFIED
                </span>
              )}
            </div>
            <p className="meta">{f.headline || 'Freelancer on LanceNest'}</p>
            {f.hourly_rate && <p className="rate">${f.hourly_rate}/hr</p>}
            <div style={{ marginTop: 10 }}>
              {f.skills?.slice(0, 4).map((s) => (
                <span className="skill-tag" key={s}>{s}</span>
              ))}
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}

export default function Directory() {
  return (
    <Suspense fallback={null}>
      <DirectoryContent />
    </Suspense>
  );
}
