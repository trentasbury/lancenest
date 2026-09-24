'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export type NavLink = { href: string; label: string };

export default function MobileMenu({
  links,
  dashboard,
  signedIn,
  signOutAction,
}: {
  links: NavLink[];
  dashboard: NavLink | null;
  signedIn: boolean;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close whenever the route changes.
  useEffect(() => setOpen(false), [pathname]);

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
        <div id="mobile-menu" className="absolute inset-x-0 top-[72px] border-b border-line bg-cream shadow-card">
          <nav className="container-page flex flex-col py-3" aria-label="Mobile">
            {dashboard && (
              <Link href={dashboard.href} className="border-b border-line py-3.5 font-medium text-navy">
                {dashboard.label}
              </Link>
            )}
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="border-b border-line py-3.5 text-ink">
                {l.label}
              </Link>
            ))}
            <div className="flex gap-3 py-4">
              {signedIn ? (
                <form action={signOutAction} className="w-full">
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
