import Link from 'next/link';
import { getSessionProfile, roleHome } from '@/lib/auth';
import { signOut } from '@/app/auth/actions';
import { initials } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import Wordmark from './Wordmark';
import MobileMenu, { type NavLink } from './MobileMenu';
import IdleTimer from './IdleTimer';

export default async function Navbar() {
  const session = await getSessionProfile();
  const profile = session?.profile ?? null;

  const links: NavLink[] = session
    ? [
        { href: '/network', label: 'Network' },
        session.profile?.role === 'employer' ? { href: '/employer/candidates', label: 'Candidates' } : { href: '/jobs', label: 'Find Jobs' },
        { href: '/messages', label: 'Messages' },
        { href: '/resources', label: 'Resources' },
      ]
    : [
        { href: '/jobs', label: 'Find Jobs' },
        { href: '/employers', label: 'For Employers' },
        { href: '/resources', label: 'Resources' },
        { href: '/about', label: 'About' },
      ];

  let unread = 0;
  if (session) {
    const { count } = await createClient().from('notifications').select('id', { count: 'exact', head: true }).eq('profile_id', session.user.id).is('read_at', null);
    unread = count ?? 0;
  }

  const role = profile?.role;
  const accountLinks: NavLink[] = !session ? [] : [
    { href: roleHome(role), label: role === 'admin' ? 'Admin' : role === 'employer' ? 'Employer dashboard' : 'Dashboard' },
    ...(role === 'veteran' && profile?.username ? [{ href: `/veterans/${profile.username}`, label: 'My profile' }] : []),
    ...(role === 'veteran' ? [{ href: '/dashboard/profile', label: 'Edit profile' }, { href: '/dashboard/verification', label: 'Verification' }, { href: '/plans', label: 'Plans & upgrades' }] : []),
    ...(role === 'employer' ? [{ href: '/employer/jobs/new', label: 'Post a job' }, { href: '/employer/analytics', label: 'Hiring analytics' }, { href: '/employers', label: 'Plans & billing' }] : []),
    { href: '/network?view=saved', label: 'Saved posts' },
    { href: '/settings/account', label: 'Account settings' },
  ];
  const dashboard = session
    ? { href: roleHome(profile?.role), label: profile?.role === 'admin' ? 'Admin' : profile?.role === 'employer' ? 'Employer Dashboard' : 'Dashboard' }
    : null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur">
      {session && <IdleTimer />}
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
              <Link href="/notifications" className="relative flex h-9 w-9 items-center justify-center rounded-full text-navy hover:bg-cream" aria-label={unread ? `${unread} unread notifications` : 'Notifications'}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brass px-1 text-[10px] font-semibold text-navy-deep">{unread > 9 ? '9+' : unread}</span>
                )}
              </Link>
              {dashboard && (
                <details className="relative">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-ink hover:text-brass-dark">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-brass bg-navy font-serif text-xs text-brass">
                      {initials(profile?.full_name)}
                    </span>
                    <span className="hidden xl:inline">{profile?.full_name?.split(' ')[0] ?? 'Account'}</span>
                    <span aria-hidden="true" className="text-xs text-muted">▾</span>
                  </summary>
                  <div className="absolute right-0 z-50 mt-2 w-60 rounded-[4px] border border-line bg-ivory p-2 text-sm shadow-card">
                    {accountLinks.map((l) => (
                      <Link key={l.href} href={l.href} className="block rounded-[3px] px-3 py-2 hover:bg-cream">{l.label}</Link>
                    ))}
                    <form action={signOut} className="mt-1 border-t border-line pt-1">
                      <button type="submit" className="w-full rounded-[3px] px-3 py-2 text-left text-signal hover:bg-signal/5">Log out</button>
                    </form>
                  </div>
                </details>
              )}
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

        <MobileMenu
          links={session ? [...links, { href: '/notifications', label: unread ? `Notifications (${unread})` : 'Notifications' }, ...accountLinks.slice(1)] : links}
          dashboard={dashboard}
          signedIn={!!session}
          signOutAction={signOut}
        />
      </div>
    </header>
  );
}
