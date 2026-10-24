import type { Metadata } from 'next';
import Link from 'next/link';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AI_ENABLED, aiAllowance } from '@/lib/ai';
import WriterForm from './WriterForm';

export const metadata: Metadata = { title: 'AI résumé writer', robots: { index: false } };

export default async function ResumeWriterPage() {
  const { user } = await requireVerifiedMember('/dashboard/resume-writer');
  const { data } = await (await createClient()).from('military_service').select('id, branch, duty_title, rank, occupation_code, occupation:military_occupations(title)').eq('profile_id', user.id).order('start_date', { ascending: false });
  const services = ((data ?? []) as unknown as { id: string; branch: string; duty_title: string | null; rank: string | null; occupation_code: string | null; occupation: { title: string } | null }[])
    .map((s) => ({ id: s.id, label: [s.duty_title ?? s.occupation?.title ?? 'Service', s.occupation_code, s.branch].filter(Boolean).join(' · ') }));
  const allowance = AI_ENABLED ? await aiAllowance(user.id) : null;
  return (
    <div className="container-page max-w-3xl py-10">
      <Link href="/dashboard" className="text-sm text-muted hover:text-navy">← Dashboard</Link>
      <h1 className="mt-3 font-serif text-4xl font-medium">AI résumé writer</h1>
      <p className="mt-2 text-muted">Turn your military job and evaluations into civilian résumé wording: a civilian job title, a summary, achievement bullets and skills.</p>
      {!AI_ENABLED ? (
        <p className="card mt-6 p-6 text-sm text-muted">The AI résumé writer is coming soon. In the meantime, the <Link href="/dashboard/resume-builder" className="text-navy underline">résumé builder</Link> turns your profile into a civilian résumé.</p>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted">{allowance!.used} of {allowance!.limit} AI drafts used this month.{allowance!.plan === 'free' ? ' Pro includes 40 a month.' : ''}</p>
          <div className="mt-6"><WriterForm services={services} /></div>
        </>
      )}
    </div>
  );
}
