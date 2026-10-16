import type { Metadata } from 'next';
import AuthShell from '@/components/auth/AuthShell';
import SignupForm from '@/components/auth/SignupForm';

export const metadata: Metadata = { title: 'Create your account', alternates: { canonical: '/signup' } };

// Pre-built and served from the location nearest each visitor. Signed-in visitors are sent to
// their dashboard before reaching this page (middleware).
export default function SignupPage() {
  return (
    <AuthShell title="Join LanceNest" subtitle="Free for every service member and veteran — always.">
      <SignupForm />
    </AuthShell>
  );
}
