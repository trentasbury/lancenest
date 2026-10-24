import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { mySpouse } from '@/lib/spouse';
import SpouseInvite from './SpouseInvite';

export const metadata: Metadata = { title: 'Invite your spouse', robots: { index: false } };

export default async function SpousePage() {
  const { user } = await requireRole(['veteran'], '/dashboard/spouse');
  const { data: v } = await (await createClient()).from('veteran_profiles').select('verification_status, member_type').eq('profile_id', user.id).maybeSingle();
  const spouse = await mySpouse(user.id);
  const isSpouse = v?.member_type === 'spouse';
  const verified = v?.verification_status === 'verified';

  return (
    <div className="container-page max-w-2xl py-12">
      <Link href="/dashboard" className="text-sm text-muted hover:text-navy">← Dashboard</Link>
      <h1 className="mt-3 font-serif text-4xl font-medium">Invite your spouse</h1>
      <p className="mt-2 text-muted">
        Military spouses can join LanceNest free, with remote and portable jobs, freelance work and the network. Your invite verifies them
        right away, so they don’t need to upload documents.
      </p>
      <div className="card mt-8 p-7">
        {isSpouse ? (
          <p className="text-sm text-muted">This page is for service members and veterans inviting their spouse.</p>
        ) : !verified ? (
          <p className="text-sm text-muted">Verify your own service first, then come back here to invite your spouse. <Link href="/dashboard/verification" className="text-navy underline">Verify my service</Link></p>
        ) : spouse ? (
          <p className="text-sm text-ink/85">✓ Linked: {spouse.username ? <Link href={`/veterans/${spouse.username}`} className="text-navy underline">{spouse.name}</Link> : spouse.name} is a verified LanceNest member through your invite. To change this, contact us through the Help page.</p>
        ) : (
          <SpouseInvite />
        )}
      </div>
      <p className="mt-4 text-xs text-muted">One linked spouse per account. Spouses can also verify on their own with documents, such as orders listing them as a dependent.</p>
    </div>
  );
}
