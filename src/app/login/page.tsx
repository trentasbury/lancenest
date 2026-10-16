import type { Metadata } from 'next';
import AuthShell from '@/components/auth/AuthShell';
import LoginForm from '@/components/auth/LoginForm';

export const metadata: Metadata = { title: 'Log in' };

// Pre-built and served from the location nearest each visitor. Signed-in visitors are sent to
// their dashboard before reaching this page (middleware).
export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Log in to continue your mission.">
      <LoginForm />
    </AuthShell>
  );
}
