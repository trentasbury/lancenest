'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 21 Q16 9 29 21" stroke="#8A5A34" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M7 23 Q16 15 25 23" stroke="#8A5A34" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="16" cy="17" r="2.4" fill="#8A5A34" />
    </svg>
  );
}

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function load(session) {
      setUser(session?.user || null);
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('role, full_name, avatar_url').eq('id', session.user.id).single();
        setProfile(data);
      } else {
        setProfile(null);
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => load(session));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  const dashboardHref = profile?.role === 'freelancer' ? '/dashboard/freelancer' : profile?.role === 'client' ? '/dashboard/client' : '/directory';

  return (
    <div className="nav-overlay" style={{ background: 'var(--marble)' }}>
      <div className="nav-overlay-inner">
        <a href="/" className="brand">
          <Logo />
          <span className="wordmark">LanceNest</span>
        </a>

        <div className="nav-links-plain nav-desktop-only">
          <a href="/directory">Hire veterans</a>
          <a href="/listings">Projects</a>
          {user && <a href="/network">Network</a>}
          {user && <a href={`/profile/${user.id}`}>My profile</a>}
          {user && <a href={dashboardHref}>Dashboard</a>}
        </div>

        <div className="nav-desktop-only" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {user ? (
            <button
              onClick={handleLogout}
              className="btn btn-outline"
              style={{ borderRadius: 999, padding: '11px 22px', cursor: 'pointer', border: '1px solid #b3261e', color: '#b3261e' }}
            >
              Log out
            </button>
          ) : (
            <>
              <a href="/login" className="btn btn-outline" style={{ borderRadius: 999, padding: '13px 26px' }}>Log in</a>
              <a href="/signup" className="wood-pill">Sign up</a>
            </>
          )}
        </div>

        <button
          className="nav-mobile-only"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
          style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            {open ? (
              <path d="M6 6L18 18M6 18L18 6" stroke="#1A1815" strokeWidth="1.8" strokeLinecap="round" />
            ) : (
              <>
                <path d="M4 7H20" stroke="#1A1815" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M4 12H20" stroke="#1A1815" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M4 17H20" stroke="#1A1815" strokeWidth="1.8" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="nav-mobile-menu">
          <a href="/directory" onClick={() => setOpen(false)}>Hire talent</a>
          <a href="/listings" onClick={() => setOpen(false)}>Find work</a>
          {user && <a href="/network" onClick={() => setOpen(false)}>Network</a>}
          {user ? (
            <>
              <a href={`/profile/${user.id}`} onClick={() => setOpen(false)}>My profile</a>
              <a href={dashboardHref} onClick={() => setOpen(false)}>Dashboard</a>
              {profile?.role === 'freelancer' && <a href="/wallet" onClick={() => setOpen(false)}>Wallet</a>}
              <a href="#" onClick={(e) => { e.preventDefault(); setOpen(false); handleLogout(); }} style={{ color: '#b3261e' }}>Log out</a>
            </>
          ) : (
            <>
              <a href="/login" onClick={() => setOpen(false)}>Log in</a>
              <a href="/signup" className="wood-pill" style={{ textAlign: 'center' }} onClick={() => setOpen(false)}>Sign up</a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
