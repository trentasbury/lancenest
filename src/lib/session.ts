/** Session limits. Change these two numbers to tighten or relax them. */
export const IDLE_LIMIT_MS = 30 * 60 * 1000; // sign out after 30 minutes of inactivity
export const MAX_SESSION_MS = 12 * 60 * 60 * 1000; // always re-authenticate after 12 hours

export const LAST_SEEN_COOKIE = 'ln_last_seen';
export const SESSION_START_COOKIE = 'ln_session_start';

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  // Must outlive the limits it enforces: if these cookies expired first, an old session would look brand new.
  maxAge: 30 * 24 * 60 * 60,
};

/**
 * Menu hint for pre-built pages: 'veteran' | 'employer' | 'admin' | 'client' | 'member' while signed in, absent when
 * signed out. The page's own script reads it so the right menu shows before first paint. It only changes
 * what the menu looks like; every protected page and action still checks the real session on the server.
 */
export const NAV_COOKIE = 'ln_nav';
export const NAV_ROLES = ['veteran', 'employer', 'admin', 'client', 'member'] as const;
export type NavRole = (typeof NAV_ROLES)[number];

export const navCookieOptions = {
  httpOnly: false, // read by the page's menu script
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 30 * 24 * 60 * 60,
};

export function navRoleFor(role: string | null | undefined): NavRole {
  return role === 'veteran' || role === 'employer' || role === 'admin' || role === 'client' ? role : 'member';
}
