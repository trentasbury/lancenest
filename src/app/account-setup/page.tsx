import type { Metadata } from 'next';
import { signOut } from '@/app/auth/actions';

export const metadata: Metadata = { title: 'Account setup' };

export default function AccountSetupPage() {
  return (
    <div className="container-page max-w-xl py-24 text-center">
      <h1 className="font-serif text-4xl font-medium">We couldn’t finish setting up your account</h1>
      <p className="mt-4 text-muted">
        You’re signed in, but your LanceNest profile wasn’t created. Sign out and back in; if this keeps happening, contact
        the LanceNest team so we can fix it for you.
      </p>
      <form action={signOut} className="mt-8">
        <button type="submit" className="btn btn-primary">Sign out</button>
      </form>
    </div>
  );
}
