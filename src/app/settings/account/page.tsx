import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole, roleHome } from '@/lib/auth';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { deleteMyAccount } from './actions';

export const metadata: Metadata = { title: 'Account settings', robots: { index: false } };

const ERRORS: Record<string, string> = {
  confirm: 'Type DELETE and check the box to confirm.',
  failed: 'Your account couldn’t be deleted. Please try again or email support@lancenest.com.',
  admin: 'Admin accounts can’t be deleted from here. Remove the admin role first.',
};

export default async function AccountPage({ searchParams }: { searchParams: { error?: string } }) {
  const { user, profile } = await requireRole(['veteran', 'employer', 'admin'], '/settings/account');
  return (
    <div className="container-page max-w-2xl space-y-6 py-10">
      <Link href={roleHome(profile.role)} className="text-sm text-muted hover:text-navy">← Dashboard</Link>
      <h1 className="font-serif text-4xl font-medium">Account settings</h1>
      {searchParams.error && <FormMessage error={ERRORS[searchParams.error] ?? ERRORS.failed} />}

      <section className="card p-7">
        <h2 className="font-serif text-2xl font-semibold">Your account</h2>
        <p className="mt-3 text-sm"><span className="text-muted">Email:</span> {user.email}</p>
        <p className="mt-1 text-sm"><span className="text-muted">Account type:</span> <span className="capitalize">{profile.role}</span></p>
        <div className="mt-4 flex flex-wrap gap-2">
          {profile.role === 'veteran' && <Link href="/dashboard/profile" className="btn btn-outline">Edit profile</Link>}
          <Link href="/forgot-password" className="btn btn-outline">Change password</Link>
          <Link href="/network/people?tab=blocked" className="btn btn-ghost border border-line">Blocked & muted</Link>
        </div>
      </section>

      <section className="card border-signal/40 p-7">
        <h2 className="font-serif text-2xl font-semibold text-signal">Delete account</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink/85">
          This permanently deletes your profile, posts, comments, messages you sent, applications, uploaded files, and any
          verification documents{profile.role === 'employer' ? ', plus your company page and job posts. Any paid plan is canceled immediately' : ''}. It can’t be undone.
        </p>
        <form action={deleteMyAccount} className="mt-5 space-y-4">
          <div>
            <label htmlFor="confirm" className="field-label">Type DELETE to confirm</label>
            <input id="confirm" name="confirm" autoComplete="off" className="field" />
          </div>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" name="understand" className="mt-0.5 h-4 w-4 accent-signal" />
            I understand this is permanent.
          </label>
          <SubmitButton className="btn border border-signal bg-signal text-ivory hover:bg-signal/90" pendingText="Deleting…">Permanently delete my account</SubmitButton>
        </form>
      </section>
    </div>
  );
}
