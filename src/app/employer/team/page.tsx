import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { SEATS, getMyCompany } from '@/lib/employer';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { addTeamMember, removeTeamMember } from './actions';

export const metadata: Metadata = { title: 'Hiring team' };
const ERR: Record<string, string> = { notfound: 'No LanceNest account uses that email. Ask them to sign up as an employer (“I’m hiring”) first, then add them here.', ineligible: 'That account can’t be added — it must be an employer account that doesn’t own its own company.', seats: 'You’ve used every seat on your plan. Upgrade for more seats.', taken: 'That person is already on a hiring team.', save: 'That didn’t save — please try again.' };

export default async function TeamPage({ searchParams }: { searchParams: { error?: string; added?: string } }) {
  const { user } = await requireRole(['employer'], '/employer/team');
  const company = await getMyCompany(user.id);
  if (!company) redirect('/employer/dashboard');
  const { data: members } = await createAdminClient().from('company_members').select('profile_id, created_at, profile:profiles(full_name, headline)').eq('company_id', company.id);
  const seats = SEATS[company.plan] ?? 1;
  const used = 1 + (members ?? []).length;
  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <Link href="/employer/dashboard" className="text-sm text-muted hover:text-navy">← Employer dashboard</Link>
      <h1 className="font-serif text-4xl font-medium">Hiring team</h1>
      <p className="text-muted">{used} of {seats} seat{seats === 1 ? '' : 's'} used on your {company.plan} plan. Recruiters can post jobs, review applicants, search candidates, and message members. Billing and verification stay with the owner.</p>
      {searchParams.error && <FormMessage error={ERR[searchParams.error] ?? ERR.save} />}
      {searchParams.added && <FormMessage message="Added. They’ve been notified." />}
      <ul className="card divide-y divide-line">
        <li className="flex justify-between p-4"><span className="font-medium">You</span><span className="text-xs text-muted">Owner</span></li>
        {((members ?? []) as unknown as { profile_id: string; profile: { full_name: string; headline: string | null } | null }[]).map((m) => (
          <li key={m.profile_id} className="flex items-center justify-between gap-3 p-4">
            <span><span className="font-medium">{m.profile?.full_name}</span><span className="block text-xs text-muted">{m.profile?.headline}</span></span>
            {company.isOwner && <form action={removeTeamMember.bind(null, m.profile_id)}><button className="text-xs text-muted hover:text-signal">Remove</button></form>}
          </li>
        ))}
      </ul>
      {company.isOwner && (used < seats ? (
        <form action={addTeamMember} className="card flex flex-col gap-2 p-5 sm:flex-row sm:items-end">
          <div className="flex-1"><label className="field-label" htmlFor="email">Add a recruiter by their LanceNest email</label><input id="email" name="email" type="email" required className="field" /></div>
          <SubmitButton className="btn btn-primary shrink-0" pendingText="Adding…">Add to team</SubmitButton>
        </form>
      ) : <p className="card p-5 text-sm">All seats are in use. <Link href="/employers" className="text-navy underline">Professional includes 2 seats; Federal includes 5.</Link></p>)}
    </div>
  );
}
