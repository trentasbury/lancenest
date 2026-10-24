import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { importJobs, readFeed, type FeedKind } from '@/lib/jobImport';
import { PAID } from '@/lib/employer';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Daily (Vercel Cron): re-import jobs for paid, verified companies that turned on daily sync. Oldest first, ~45 seconds. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new NextResponse('Unauthorized', { status: 401 });
  const admin = createAdminClient();
  const started = Date.now();
  const { data: feeds } = await admin.from('job_feeds').select('company_id, kind, source, company:companies!inner(plan, is_verified)')
    .eq('auto_sync', true).eq('company.is_verified', true).order('last_synced_at', { ascending: true, nullsFirst: true }).limit(50);
  let synced = 0;
  for (const f of (feeds ?? []) as unknown as { company_id: string; kind: FeedKind; source: string; company: { plan: string; is_verified: boolean } }[]) {
    if (Date.now() - started > 45000) break;
    if (!PAID.includes(f.company.plan as never)) { await admin.from('job_feeds').update({ auto_sync: false }).eq('company_id', f.company_id); continue; }
    try {
      const jobs = await readFeed(f.kind, f.source);
      const result = await importJobs(admin, f.company_id, f.kind, jobs);
      await admin.from('job_feeds').update({ last_synced_at: new Date().toISOString(), last_result: result }).eq('company_id', f.company_id);
      synced++;
    } catch (e) {
      await admin.from('job_feeds').update({ last_synced_at: new Date().toISOString(), last_result: { error: (e as Error).message } }).eq('company_id', f.company_id);
    }
  }
  return NextResponse.json({ ok: true, synced });
}
