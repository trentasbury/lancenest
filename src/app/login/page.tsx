import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import LoginForm from '@/components/auth/LoginForm';
import { getSessionProfile, roleHome, safeNextPath } from '@/lib/auth';

export const metadata: Metadata = { title: 'Log in' };

export default async function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string; reason?: string } }) {
  const session = await getSessionProfile();
  if (session) redirect(roleHome(session.profile?.role));

  const notice =
    searchParams.reason === 'idle'
      ? 'For your security, you were signed out after 30 minutes of inactivity.'
      : searchParams.reason === 'expired'
        ? 'For your security, sessions end after 12 hours. Please sign in again.'
        : searchParams.error === 'link'
          ? 'That link has expired or was already used. Log in, or request a new one.'
          : searchParams.next?.startsWith('/jobs')
            ? 'Job listings are for LanceNest members. Log in, or create a free account in under a minute.'
            : undefined;
  return (
    <AuthShell title="Welcome back" subtitle="Log in to continue your mission.">
      <LoginForm next={safeNextPath(searchParams.next) ?? undefined} notice={notice} />
    </AuthShell>
  );
}
