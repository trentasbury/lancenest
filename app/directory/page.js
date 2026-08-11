'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

function DirectoryContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [freelancers, setFreelancers] = useState(null);
  const [authed, setAuthed] = useState(null);
  const [counts, setCounts] = useState(null);
  const [stateFilter, setStateFilter] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let settled = false;

    // Hard failsafe: if anything below silently hangs for any reason,
    // this guarantees the page moves on after 6 seconds instead of
    // showing "Loading..." forever.
    const failsafe = setTimeout(() => {
      if (!settled) {
        console.error('Directory load timed out after 6s — forcing logged-out view.');
        settled = true;
        setAuthed(false);
        setLoadError(false);
      }
    }, 6000);

    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (settled) return;

        if (!session) {
          settled = true;
          clearTimeout(failsafe);
          setAuthed(false);
          const { data } = await supabase.rpc('get_platform_counts');
          setCounts(data?.[0] || null);
          return;
        }

        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, headline, skills, hourly_rate, plan, is_veteran_verified, city, state, remote_ok')
          .eq('role', 'freelancer')
          .eq('is_approved', true)
          .order('plan', { ascending: false })
          .order('created_at', { ascending: false });

        if (settled) return;
        settled = true;
        clearTimeout(failsafe);
        setAuthed(true);
        setFreelancers(data || []);
      } catch (err) {
        console.error('Directory load error:', err);
        if (!settled) {
          settled = true;
          clearTimeout(failsafe);
          setLoadError(true);
        }
      }
    }
    load();

    return () => clearTimeout(failsafe);
  }, [query]);

  if (loadError) {
    return (
      <main className="plain-surface container" style={{ padding: '80px 40px', textAlign: 'center' }}>
        <p style={{ marginBottom: 16 }}>Something went wrong loading the directory.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Try again</button>
      </main>
    );
  }

  if (authed === null) return <main className="plain-surface container" style={{ padding: 48 }}>Loading...</main>;

  if (authed === false) {
    const count = counts?.freelancer_count;
    return (
      <main className="plain-surface container" style={{ padding: '80px 40px', textAlign: 'center' }}>
        <span className="eyebrow">Members only</span>
        <h1 style={{ fontSize: 32, margin: '14px 0 16px' }}>
          {typeof count === 'number' && count > 0
            ? `${count} freelancer${count === 1 ? '' : 's'} waiting to be found`
            : 'Log in to browse veteran talent'}
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

  const filtered = (freelancers || []).filter((f) => {
    if (remoteOnly && !f.remote_ok) return false;
    if (stateFilter && f.state !== stateFilter && !(remoteOnly && f.remote_ok)) return false;
    return true;
  });

  return (
    <main className="plain-surface">
      <div className="section-title" style={{ paddingTop: 32 }}>Find veteran talent</div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '0 40px 20px' }}>
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} style={{ width: 'auto', padding: '9px 12px' }}>
          <option value="">Any state</option>
          {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} style={{ width: 'auto' }} />
          Remote OK
        </label>
      </div>

      {filtered.length === 0 && (
        <div className="empty">No freelancers match these filters yet.</div>
      )}
      <div className="grid">
        {filtered.map((f) => (
          <a href={`/profile/${f.id}`} key={f.id} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>{f.full_name}</h3>
              {f.is_veteran_verified && (
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--white)', background: 'var(--wood)', padding: '2px 7px', borderRadius: 3 }}>
                  VERIFIED VETERAN
                </span>
              )}
              {(f.plan === 'pro' || f.plan === 'federal_pro') && (
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--wood)', border: '1px solid var(--wood)', padding: '1px 6px', borderRadius: 3 }}>
                  {f.plan === 'federal_pro' ? 'FEDERAL PRO' : 'PRO'}
                </span>
              )}
            </div>
            <p className="meta">{f.headline || 'Freelancer on LanceNest'}</p>
            <p className="meta" style={{ fontSize: 12 }}>
              {[f.city, f.state].filter(Boolean).join(', ')}{f.remote_ok ? (f.city || f.state ? ' · Remote OK' : 'Remote OK') : ''}
            </p>
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
