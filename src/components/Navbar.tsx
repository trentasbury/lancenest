import Link from 'next/link';
import { getSessionProfile, roleHome } from '@/lib/auth';
import { signOut } from '@/app/auth/actions';
import { initials } from '@/lib/format';
import Wordmark from './Wordmark';
import MobileMenu, { type NavLink } from './MobileMenu';

export default async function Navbar() {
  const session = await getSessionProfile();
  const profile = session?.profile ?? null;

  const links: NavLink[] = [
    { href: '/jobs', label: 'Find Jobs' },
    { href: '/employers', label: 'For Employers' },
    { href: '/resources', label: 'Resources' },
    { href: '/about', label: 'About' },
  ];

  const dashboard = session
    ? { href: roleHome(profile?.role), label: profile?.role === 'admin' ? 'Admin' : profile?.role === 'employer' ? 'Employer Dashboard' : 'Dashboard' }
    : null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur">
      <div className="container-page flex h-[72px] items-center justify-between gap-6">
        <Wordmark />

        <nav className="hidden items-center gap-8 text-[14px] text-ink lg:flex" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-brass-dark">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          {session ? (
            <>
              {dashboard && (
                <Link href={dashboard.href} className="flex items-center gap-2 text-sm text-ink hover:text-brass-dark">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-brass bg-navy font-serif text-xs text-brass">
                    {initials(profile?.full_name)}
                  </span>
                  {dashboard.label}
                </Link>
              )}
              <form action={signOut}>
                <button type="submit" className="btn btn-outline px-4 py-2">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-ink hover:text-brass-dark">
                Log in
              </Link>
              <Link href="/signup" className="btn btn-primary">
                Sign up
              </Link>
            </>
          )}
        </div>

        <MobileMenu links={links} dashboard={dashboard} signedIn={!!session} signOutAction={signOut} />
      </div>
    </header>
  );
}
