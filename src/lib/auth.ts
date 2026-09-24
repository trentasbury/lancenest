import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, Role } from '@/lib/types';

export function roleHome(role?: Role | null): string {
  if (role === 'admin') return '/admin';
  if (role === 'employer') return '/employer/dashboard';
  return '/dashboard';
}

/** Validated server-side (getUser checks the token with Supabase, unlike getSession). */
export async function getSessionProfile() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, username, headline, avatar_url, location, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle();

  return { user, profile: (profile as Profile | null) ?? null };
}

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
  if (!roles.includes(session.profile.role)) {
    redirect(roleHome(session.profile.role));
  }
  return { user: session.user, profile: session.profile };
}

/** Only allow same-site relative redirects (prevents open-redirect abuse). */
export function safeNextPath(value: FormDataEntryValue | string | null | undefined): string | null {
  const next = typeof value === 'string' ? value : null;
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}
