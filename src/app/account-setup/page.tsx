import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { signOut } from '@/app/auth/actions';
import { createClient } from '@/lib/supabase/server';
import { isFreshAccount } from '@/lib/oauth';
import SubmitButton from '@/components/SubmitButton';
import { chooseAccountType } from './actions';

export const metadata: Metadata = { title: 'Account setup', robots: { index: false } };

const CHOICES = [
  ['veteran', 'I’m a service member or veteran', 'Active duty, National Guard, Reserve, transitioning, or veteran — build your profile and find your next role.'],
  ['employer', 'I’m hiring', 'Any company or recruiter — post roles and search verified military talent.'],
] as const;

export default async function AccountSetupPage({ searchParams }: { searchParams: { choose?: string; next?: string } }) {
  if (searchParams.choose) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');
    const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle();
    // Only brand-new service member accounts can still pick; everyone else goes straight on.
    if (profile && profile.role === 'veteran' && isFreshAccount(user.created_at)) {
      const first = String(profile.full_name ?? '').split(' ')[0];
      return (
        <div className="container-page max-w-2xl py-16">
          <p className="eyebrow">Welcome{first ? `, ${first}` : ''}</p>
          <h1 className="mt-2 font-sans text-3xl font-bold tracking-tight text-ink">How will you use LanceNest?</h1>
          <p className="mt-2 text-muted">Your account is created. Pick one to finish — you won’t be asked again.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {CHOICES.map(([value, title, body]) => (
              <form key={value} action={chooseAccountType.bind(null, value, searchParams.next ?? '')}>
                <SubmitButton className="card card-hover block h-full w-full p-6 text-left" pendingText="Setting up…">
                  <span className="block font-serif text-xl font-semibold text-ink">{title}</span>
                  <span className="mt-2 block text-sm leading-relaxed text-muted">{body}</span>
                </SubmitButton>
              </form>
            ))}
          </div>
        </div>
      );
    }
    redirect(profile?.role === 'employer' ? '/employer/dashboard' : profile?.role === 'admin' ? '/admin' : '/dashboard');
  }

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
