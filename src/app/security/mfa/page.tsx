import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EnrollForm, VerifyForm } from './MfaForms';

export const metadata: Metadata = { title: 'Two-step login', robots: { index: false } };

export default async function MfaPage() {
  await requireRole(['admin'], '/security/mfa');
  const supabase = createClient();
  const [{ data: factors }, { data: aal }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const verified = (factors?.totp ?? []).filter((f) => f.status === 'verified');
  const done = aal?.currentLevel === 'aal2';

  return (
    <div className="container-page flex max-w-md flex-col py-16">
      <div className="card p-8">
        <p className="eyebrow">Admin security</p>
        <h1 className="mt-2 font-serif text-3xl font-medium">Two-step login</h1>
        {done ? (
          <>
            <p className="mt-3 text-sm text-muted">Two-step login is on and this session is verified.</p>
            <Link href="/admin" className="btn btn-primary mt-6 w-full">Go to admin</Link>
          </>
        ) : verified.length > 0 ? (
          <>
            <p className="mt-3 text-sm text-muted">Admin access requires a code from your authenticator app each time you sign in.</p>
            <div className="mt-6"><VerifyForm factorId={verified[0].id} /></div>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-muted">
              Admin accounts can open members’ service documents, so they require a second step: a 6-digit code from an app on your phone. It takes about a minute to set up.
            </p>
            <div className="mt-6"><EnrollForm /></div>
          </>
        )}
      </div>
    </div>
  );
}
