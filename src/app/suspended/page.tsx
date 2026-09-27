import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export default async function SuspendedPage() {
  const session = await getSessionProfile();
  const until = session?.profile?.suspended_until;
  if (!until || new Date(until) <= new Date()) redirect('/');
  const { data: strike } = await createClient().from('member_strikes').select('reason').eq('profile_id', session!.user.id).eq('level', 'suspension').order('created_at', { ascending: false }).limit(1).maybeSingle();
  return (
    <div className="container-page flex max-w-lg flex-col py-20 text-center">
      <p className="eyebrow text-signal">Account suspended</p>
      <h1 className="mt-3 font-serif text-4xl font-medium">Your account is suspended until {new Date(until).toLocaleDateString('en-US', { dateStyle: 'long' })}.</h1>
      {strike?.reason && <p className="mt-4 text-muted">Reason: {strike.reason as string}</p>}
      <p className="mt-4 text-sm text-muted">Review our <Link href="/conduct" className="underline">Code of Conduct</Link>. A further violation leads to removal. To appeal, email support@lancenest.com.</p>
      <Link href="/settings/account" className="btn btn-outline mx-auto mt-8">Account settings</Link>
    </div>
  );
}
