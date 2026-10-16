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

/** The account menu under the avatar. */
export function accountLinks(role: Role | null | undefined, username: string | null | undefined): NavLink[] {
  return [
    dashboardLink(role),
    ...((role === 'veteran' || role === 'admin') && username ? [{ href: `/veterans/${username}`, label: 'My profile' }] : []),
    ...(role === 'admin' ? [{ href: '/dashboard/profile', label: 'Edit profile' }] : []),
    ...(role === 'veteran' ? [{ href: '/dashboard/profile', label: 'Edit profile' }, { href: '/dashboard/applications', label: 'My applications' }, { href: '/dashboard/alerts', label: 'Job alerts' }, { href: '/freelance/earnings', label: 'Earnings' }, { href: '/groups', label: 'Groups' }, { href: '/mentors', label: 'Mentors' }, { href: '/fairs', label: 'Career fairs' }, { href: '/dashboard/resume-builder', label: 'Résumé builder' }, { href: '/dashboard/verification', label: 'Verification' }, { href: '/transition', label: 'Transition Hub & SkillBridge' }, { href: '/training', label: 'Training & certifications' }, { href: '/plans', label: 'Plans & upgrades' }] : []),
    ...(role === 'employer' ? [{ href: '/employer/jobs/new', label: 'Post a job' }, { href: '/employer/analytics', label: 'Hiring analytics' }, { href: '/employer/training', label: 'Training listings' }, { href: '/employer/talent', label: 'Talent pools' }, { href: '/employer/team', label: 'Hiring team' }, { href: '/fairs', label: 'Career fairs' }, { href: '/employer/company', label: 'Company page' }, { href: '/employers', label: 'Plans & billing' }] : []),
    { href: '/network?view=saved', label: 'Saved posts' },
    { href: '/settings/account', label: 'Account settings' },
  ];
}
