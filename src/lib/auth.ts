import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, Role } from '@/lib/types';
import { roleHome, safeNextPath } from '@/lib/nav';

// Shared with the browser-side menu; re-exported here so existing imports keep working.
export { roleHome, safeNextPath };

/**
 * Validated server-side (getUser checks the token with Supabase, unlike getSession).
 * Wrapped in React cache(): the navbar, layouts, and page of one request share a single
 * check instead of each repeating it.
 */
export const getSessionProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, username, headline, avatar_url, location, onboarding_completed, suspended_until, banned')
    .eq('id', user.id)
    .maybeSingle();

  return { user, profile: (profile as Profile | null) ?? null };
});

/** The member's verification status, looked up once per request. */
const getVerificationStatus = cache(async (profileId: string) => {
  const { data } = await (await createClient()).from('veteran_profiles').select('verification_status').eq('profile_id', profileId).maybeSingle();
  return (data?.verification_status as string | undefined) ?? null;
});

/** Server-side gate for protected pages/layouts. Never rely on client-side role checks. */
export async function requireRole(roles: Role[], nextPath?: string) {
  const session = await getSessionProfile();
  if (!session) {
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login');
  }
  if (!session.profile) {
    // Profile row missing — send somewhere that cannot loop back here.
    redirect('/account-setup');
  }
  // Conduct enforcement: removed accounts are locked out; suspended accounts can only manage their account.
  if (session.profile.banned) redirect('/removed');
  if (session.profile.suspended_until && new Date(session.profile.suspended_until) > new Date() && nextPath !== '/settings/account') redirect('/suspended');
  if (!roles.includes(session.profile.role)) {
    redirect(roleHome(session.profile.role));
  }
  return { user: session.user, profile: session.profile };
}


/** Admin pages and actions: requires the admin role AND a session that passed two-step verification. */
export async function requireAdmin(nextPath = '/admin') {
  const session = await requireRole(['admin'], nextPath);
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel !== 'aal2') redirect('/security/mfa');
  return session;
}

/**
 * Jobs, the network, messaging, and member profiles are for verified service members.
 * Employers and admins pass; unverified veteran accounts are sent to verification.
 * (The database enforces the same rule.)
 */
export async function requireVerifiedMember(nextPath: string) {
  const session = await requireRole(['veteran', 'employer', 'admin'], nextPath);
  if (session.profile.role === 'veteran') {
    if ((await getVerificationStatus(session.user.id)) !== 'verified') redirect(`/dashboard/verification?required=1`);
  }
  return session;
}
