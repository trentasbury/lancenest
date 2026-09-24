import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import LoginForm from '@/components/auth/LoginForm';
import { getSessionProfile, roleHome, safeNextPath } from '@/lib/auth';

export const metadata: Metadata = { title: 'Log in' };

export default async function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  const session = await getSessionProfile();
  if (session) redirect(roleHome(session.profile?.role));

  const notice = searchParams.error === 'link' ? 'That link has expired or was already used. Log in, or request a new one.' : undefined;
  return (
    <AuthShell title="Welcome back" subtitle="Log in to continue your mission.">
      <LoginForm next={safeNextPath(searchParams.next) ?? undefined} notice={notice} />
    </AuthShell>
  );
}
