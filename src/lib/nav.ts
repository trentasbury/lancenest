// Navigation shared by the server and the browser (no server-only imports here).
import type { Role } from '@/lib/types';

export type NavLink = { href: string; label: string };

export function roleHome(role?: Role | null): string {
  if (role === 'admin') return '/admin';
  if (role === 'employer') return '/employer/dashboard';
  return '/dashboard';
}

/** Only allow same-site relative redirects (prevents open-redirect abuse). */
export function safeNextPath(value: FormDataEntryValue | string | null | undefined): string | null {
  const next = typeof value === 'string' ? value : null;
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

/** Top menu for visitors who aren't signed in. */
export const PUBLIC_LINKS: NavLink[] = [
  { href: '/jobs', label: 'Find Jobs' },
  { href: '/employers', label: 'For Employers' },
  { href: '/resources', label: 'Resources' },
  { href: '/about', label: 'About' },
];

/** Top menu for signed-in members (the third link depends on the role). */
export function memberLinks(role?: Role | null): NavLink[] {
  return [
    { href: '/network', label: 'Network' },
    { href: '/people', label: 'People' },
    role === 'employer' ? { href: '/employer/candidates', label: 'Candidates' } : { href: '/jobs', label: 'Find Jobs' },
    { href: '/freelance', label: 'Freelance' },
    { href: '/messages', label: 'Messages' },
  ];
}

export function dashboardLink(role?: Role | null): NavLink {
  return { href: roleHome(role), label: role === 'admin' ? 'Admin' : role === 'employer' ? 'Employer dashboard' : 'Dashboard' };
}

/**
 * The button at the top of the account menu: your public profile (members) or company page (employers),
 * like LinkedIn's "View profile". Editing happens from that page, not from the menu.
 */
export function profileLink(role: Role | null | undefined, username: string | null | undefined, companySlug?: string | null): NavLink {
  if (role === 'employer') return companySlug ? { href: `/companies/${companySlug}`, label: 'View company page' } : { href: '/employer/dashboard', label: 'Set up your company page' };
  return username ? { href: `/veterans/${username}`, label: 'View profile' } : { href: '/dashboard/profile', label: 'Set up your profile' };
}

/**
 * The account menu under the avatar: kept short on purpose. Everything else lives on the
 * dashboard (members) or employer dashboard, so the menu stays readable.
 */
export function accountLinks(role: Role | null | undefined): NavLink[] {
  if (role === 'employer') {
    return [
      dashboardLink(role),
      { href: '/employer/jobs/new', label: 'Post a job' },
      { href: '/employer/team', label: 'Hiring team' },
      { href: '/network?view=saved', label: 'Saved posts' },
      { href: '/employers', label: 'Plans & billing' },
      { href: '/settings/account', label: 'Settings & privacy' },
    ];
  }
  if (role === 'admin') {
    return [dashboardLink(role), { href: '/network?view=saved', label: 'Saved posts' }, { href: '/settings/account', label: 'Settings & privacy' }];
  }
  return [
    dashboardLink(role),
    { href: '/dashboard/applications', label: 'My applications' },
    { href: '/network?view=saved', label: 'Saved posts' },
    { href: '/plans', label: 'Plans & upgrades' },
    { href: '/settings/account', label: 'Settings & privacy' },
  ];
}
