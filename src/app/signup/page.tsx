import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import SignupForm from '@/components/auth/SignupForm';
import { getSessionProfile, roleHome } from '@/lib/auth';

export const metadata: Metadata = { title: 'Create your account' };

export default async function SignupPage({ searchParams }: { searchParams: { role?: string } }) {
  const session = await getSessionProfile();
  if (session) redirect(roleHome(session.profile?.role));

  return (
    <AuthShell title="Join LanceNest" subtitle="Free for every service member and veteran — always.">
      <SignupForm defaultRole={searchParams.role === 'employer' ? 'employer' : 'veteran'} />
    </AuthShell>
  );
}
