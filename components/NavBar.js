'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('role, full_name, avatar_url').eq('id', session.user.id).single();
        setProfile(data);
      } else {
        setProfile(null);
      }
    }
    load();

    const { data: listener } = supabase.auth.onAuthStateChange(() => load());
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  const dashboardHref = profile?.role === 'freelancer' ? '/dashboard/freelancer' : profile?.role === 'client' ? '/dashboard/client' : '/directory';
  const initial = profile?.full_name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="nav-overlay" style={{ background: 'var(--marble)' }}>
      <div className="nav-overlay-inner">
        <a href="/" className="brand">
          <Logo />
          <span className="wordmark">LanceNest</span>
        </a>

        <div className="nav-links-plain nav-desktop-only">
          <a href="/directory">Hire freelancers</a>
          <a href="/listings">Projects</a>
          {user && <a href="/network">Network</a>}
        </div>

        <div className="nav-desktop-only" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {user ? (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  border: '1px solid var(--line)',
                  background: profile?.avatar_url ? `url(${profile.avatar_url}) center/cover` : 'var(--wood)',
                  color: 'var(--white)',
                  cursor: 'pointer',
                  fontFamily: 'Cormorant Garamond, serif',
                  fontSize: 16,
                  fontWeight: 600,
                }}
                aria-label="Account menu"
              >
                {!profile?.avatar_url && initial}
              </button>

              {menuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 48,
                    width: 200,
                    background: 'var(--white)',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                    boxShadow: '0 12px 30px rgba(26,24,21,0.12)',
                    overflow: 'hidden',
                    zIndex: 50,
                  }}
                >
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{profile?.full_name}</p>
                  </div>
                  <a href={`/profile/${user.id}`} style={{ display: 'block', padding: '10px 16px', fontSize: 13.5 }} onClick={() => setMenuOpen(false)}>
                    View my profile
                  </a>
                  <a href={dashboardHref} style={{ display: 'block', padding: '10px 16px', fontSize: 13.5 }} onClick={() => setMenuOpen(false)}>
                    Dashboard
                  </a>
                  {profile?.role === 'freelancer' && (
                    <a href="/wallet" style={{ display: 'block', padding: '10px 16px', fontSize: 13.5 }} onClick={() => setMenuOpen(false)}>
                      Wallet
                    </a>
                  )}
                  <a href="/network" style={{ display: 'block', padding: '10px 16px', fontSize: 13.5 }} onClick={() => setMenuOpen(false)}>
                    Network
                  </a>
                  <button
                    onClick={handleLogout}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 13.5, border: 'none', borderTop: '1px solid var(--line)', background: 'none', cursor: 'pointer', color: '#b3261e' }}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
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
              <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}>Log out</a>
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
