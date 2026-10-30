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
  ['spouse', 'I’m a military spouse', 'Married to someone who serves or served — remote and portable jobs, freelance work, and a network that gets military life.'],
  ['employer', 'I’m hiring for a company', 'Any company or recruiter — post roles and search verified military talent.'],
  ['client', 'I want to hire a freelancer', 'Free for anyone — book a verified veteran for a project.'],
] as const;

export default async function AccountSetupPage(props: { searchParams: Promise<{ choose?: string; next?: string }> }) {
  const searchParams = await props.searchParams;
  if (searchParams.choose) {
    const supabase = await createClient();
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
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
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
    redirect(profile?.role === 'employer' ? '/employer/dashboard' : profile?.role === 'admin' ? '/admin' : profile?.role === 'client' ? '/freelance' : '/dashboard');
  }

  // Reached when a signed-in account has no profile. Anyone else is sent where they belong.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: existing } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (existing) redirect(existing.role === 'employer' ? '/employer/dashboard' : existing.role === 'admin' ? '/admin' : '/dashboard');

  return (
    <div className="container-page max-w-xl py-24 text-center">
      <h1 className="font-serif text-4xl font-medium">We couldn’t finish setting up your account</h1>
      <p className="mt-4 text-muted">
        You’re signed in, but your LanceNest profile wasn’t created. Sign out and back in; if this keeps happening,{' '}
        <a href="/help?kind=bug&subject=Account%20setup" className="text-navy underline">tell us through the Help page</a> and we’ll fix it for you.
      </p>
      <form action={signOut} className="mt-8">
        <button type="submit" className="btn btn-primary">Sign out</button>
      </form>
    </div>
  );
}
