'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FEED_SYNC, getMyCompany } from '@/lib/employer';
import { importJobs, readFeed, validSource, type FeedKind, type ImportResult } from '@/lib/jobImport';
import { refreshPublicJobs } from '@/lib/publicRefresh';

export type ImportState = { result?: ImportResult; error?: string };
const KINDS: FeedKind[] = ['greenhouse', 'lever', 'ashby', 'xml'];

export async function runImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const { user } = await requireRole(['employer'], '/employer/jobs/import');
  const company = await getMyCompany(user.id);
  if (!company) return { error: 'Set up your company first.' };
  if (!company.is_verified) return { error: 'Your company needs to be verified before importing jobs.' };
  const kind = String(formData.get('kind') ?? '') as FeedKind;
  // Accept the board name or its full public address (boards.greenhouse.io/acme, jobs.lever.co/acme, jobs.ashbyhq.com/acme).
  const raw = String(formData.get('source') ?? '').trim();
  const src = kind === 'xml' ? raw : raw.replace(/^https?:\/\//i, '').replace(/^((boards|job-boards)\.greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com)\//i, '').split(/[/?#]/)[0];
  if (!KINDS.includes(kind) || !validSource(kind, src)) return { error: kind === 'xml' ? 'Enter the full https:// address of your XML job feed.' : 'Enter your job board name (the part after the slash in your public job board address).' };

  let jobs;
  try { jobs = await readFeed(kind, src); } catch (e) {
    const m = (e as Error).message;
    return { error: m === 'feed_404' ? 'We couldn’t find that job board. Check the name and try again.' : m === 'feed_too_big' ? 'That feed is too large (over 5 MB).' : m === 'bad_source' ? 'That address can’t be used. It must be a public https:// address.' : 'We couldn’t read that feed right now. Please try again in a few minutes.' };
  }
  if (!jobs.length) return { error: 'We reached the job board, but it has no open jobs right now.' };

  const result = await importJobs(await createClient(), company.id, kind, jobs);
  const autoSync = formData.get('auto_sync') === 'on' && FEED_SYNC.includes(company.plan);
  await createAdminClient().from('job_feeds').upsert({ company_id: company.id, kind, source: src, auto_sync: autoSync, last_synced_at: new Date().toISOString(), last_result: result }, { onConflict: 'company_id' });
  revalidatePath('/employer/dashboard');
  revalidatePath('/jobs');
  refreshPublicJobs();
  return { result };
}
