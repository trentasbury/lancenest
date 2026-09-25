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
  maxAge: MAX_SESSION_MS / 1000,
};
