'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { PUBLIC_LINKS, accountLinks, dashboardLink, memberLinks, profileLink, type NavLink } from '@/lib/nav';
import type { Role } from '@/lib/types';
import { markSignedOut, useMe } from './nav/useMe';

export type { NavLink };

/** Phone and tablet menu. Works out signed-in vs signed-out in the browser (pages are pre-built). */
export default function MobileMenu({ signOutAction }: { signOutAction: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const me = useMe();

  // Close whenever the route changes.
  useEffect(() => setOpen(false), [pathname]);

  // The menu only renders once opened (after the page is interactive), so reading the page's hint is safe here.
  const hint = open && typeof document !== 'undefined' ? document.documentElement.getAttribute('data-nav') ?? 'out' : 'out';
  const signedIn = me ? me.signedIn : hint !== 'out';
  const role: Role | null = me?.signedIn ? me.role : hint === 'veteran' || hint === 'employer' || hint === 'admin' ? hint : null;
  const unread = me?.signedIn ? me.unread : 0;
  const username = me?.signedIn ? me.username : null;
  const companySlug = me?.signedIn ? me.companySlug ?? null : null;

  const dashboard = signedIn ? dashboardLink(role) : null;
  // "View profile" needs the member's details; until they load, the dashboard link covers it.
  const profile = signedIn && me?.signedIn ? profileLink(role, username, companySlug) : null;
  const links: NavLink[] = signedIn
    ? [...(profile ? [profile] : []), ...memberLinks(role), { href: '/notifications', label: unread ? `Notifications (${unread})` : 'Notifications' }, ...accountLinks(role).slice(1)]
    : PUBLIC_LINKS;

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-line text-navy"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open && (
        <div id="mobile-menu" className="absolute inset-x-0 top-[72px] max-h-[calc(100dvh-72px)] overflow-y-auto overscroll-contain border-b border-line bg-cream shadow-card">
          <nav className="container-page flex flex-col py-3" aria-label="Mobile">
            {dashboard && (
              <Link href={dashboard.href} className="border-b border-line py-3.5 font-medium text-navy">
                {dashboard.label}
              </Link>
            )}
            {links.map((l) => (
              <Link key={l.href + l.label} href={l.href} className="border-b border-line py-3.5 text-ink">
                {l.label}
              </Link>
            ))}
            <div className="flex gap-3 py-4">
              {signedIn ? (
                <form action={signOutAction} onSubmit={markSignedOut} className="w-full">
                  <button type="submit" className="btn btn-outline w-full">
                    Log out
                  </button>
                </form>
              ) : (
                <>
                  <Link href="/login" className="btn btn-outline flex-1">
                    Log in
                  </Link>
                  <Link href="/signup" className="btn btn-primary flex-1">
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
