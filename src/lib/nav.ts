// Navigation shared by the server and the browser (no server-only imports here).
import type { Role } from '@/lib/types';

export type NavLink = { href: string; label: string };

export function roleHome(role?: Role | null): string {
  if (role === 'admin') return '/admin';
  if (role === 'employer') return '/employer/dashboard';
  if (role === 'client') return '/freelance';
  return '/dashboard';
}

/** Only allow same-site relative redirects (prevents open-redirect abuse). */
export function safeNextPath(value: FormDataEntryValue | string | null | undefined): string | null {
  const next = typeof value === 'string' ? value : null;
  // Same-site paths only: "/x" yes; "//x" and "/\\x" (browsers read a backslash as a slash) and control characters no.
  return next && /^\/(?![/\\])/.test(next) && !/[\\\u0000-\u001f]/.test(next) ? next : null;
}

/** Top menu for visitors who aren't signed in. */
export const PUBLIC_LINKS: NavLink[] = [
  { href: '/open-jobs', label: 'Find Jobs' },
  { href: '/employers', label: 'For Employers' },
  { href: '/hire', label: 'Hire Freelancers' },
  { href: '/resources', label: 'Resources' },
  { href: '/about', label: 'About' },
];

/** Top menu for signed-in members (the third link depends on the role). */
export function memberLinks(role?: Role | null): NavLink[] {
  // Clients hire freelancers only: no member network, people or jobs.
  if (role === 'client') return [{ href: '/freelance', label: 'Your projects' }, { href: '/freelance/services', label: 'Find freelancers' }, { href: '/messages', label: 'Messages' }];
  return [
    { href: '/network', label: 'Network' },
    { href: '/people', label: 'People' },
    role === 'employer' ? { href: '/employer/candidates', label: 'Candidates' } : { href: '/jobs', label: 'Find Jobs' },
    { href: '/freelance', label: 'Freelance' },
    { href: '/messages', label: 'Messages' },
  ];
}

export function dashboardLink(role?: Role | null): NavLink {
  return { href: roleHome(role), label: role === 'admin' ? 'Admin' : role === 'employer' ? 'Employer dashboard' : role === 'client' ? 'Your projects' : 'Dashboard' };
}

/**
 * The button at the top of the account menu: your public profile (members) or company page (employers),
 * like LinkedIn's "View profile". Editing happens from that page, not from the menu.
 */
export function profileLink(role: Role | null | undefined, username: string | null | undefined, companySlug?: string | null): NavLink {
  if (role === 'client') return { href: '/freelance', label: 'Your projects' };
  if (role === 'employer') return companySlug ? { href: `/companies/${companySlug}`, label: 'View company page' } : { href: '/employer/dashboard', label: 'Set up your company page' };
  return username ? { href: `/veterans/${username}`, label: 'View profile' } : { href: '/dashboard/profile', label: 'Set up your profile' };
}

/**
 * The account menu under the avatar: kept short on purpose. Everything else lives on the
 * dashboard (members) or employer dashboard, so the menu stays readable.
 */
const HELP: NavLink = { href: '/help', label: 'Help & feedback' };

export function accountLinks(role: Role | null | undefined): NavLink[] {
  if (role === 'employer') {
    return [
      dashboardLink(role),
      { href: '/employer/jobs/new', label: 'Post a job' },
      { href: '/employer/team', label: 'Hiring team' },
      { href: '/network?view=saved', label: 'Saved posts' },
      { href: '/employers', label: 'Plans & billing' },
      { href: '/settings/account', label: 'Settings & privacy' },
      HELP,
    ];
  }
  if (role === 'client') {
    return [dashboardLink(role), { href: '/freelance/projects/new', label: 'Post a project' }, { href: '/freelance/services', label: 'Find freelancers' }, { href: '/settings/account', label: 'Settings & privacy' }, HELP];
  }
  if (role === 'admin') {
    return [dashboardLink(role), { href: '/admin/feedback', label: 'Help & feedback queue' }, { href: '/network?view=saved', label: 'Saved posts' }, { href: '/settings/account', label: 'Settings & privacy' }];
  }
  return [
    dashboardLink(role),
    { href: '/dashboard/applications', label: 'My applications' },
    { href: '/network?view=saved', label: 'Saved posts' },
    { href: '/plans', label: 'Plans & upgrades' },
    { href: '/settings/account', label: 'Settings & privacy' },
    HELP,
  ];
}
