'use client';

import { useState } from 'react';

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
          <a href="/messages">Messages</a>
        </div>
        <div className="nav-desktop-only" style={{ display: 'flex', gap: 10 }}>
          <a href="/login" className="btn btn-outline" style={{ borderRadius: 999, padding: '13px 26px' }}>Log in</a>
          <a href="/signup" className="wood-pill">Sign up</a>
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
          <a href="/messages" onClick={() => setOpen(false)}>Messages</a>
          <a href="/login" onClick={() => setOpen(false)}>Log in</a>
          <a href="/signup" className="wood-pill" style={{ textAlign: 'center' }} onClick={() => setOpen(false)}>Sign up</a>
        </div>
      )}
    </div>
  );
}
