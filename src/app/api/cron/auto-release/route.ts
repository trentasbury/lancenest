import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { releaseMilestone } from '@/lib/payments';

/** Daily (Vercel Cron): pay out submitted milestones the client hasn’t acted on within 14 days. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new NextResponse('Unauthorized', { status: 401 });
  const { data } = await createAdminClient().from('milestones').select('id').eq('status', 'submitted').lte('auto_release_at', new Date().toISOString()).limit(100);
  let released = 0;
  for (const m of data ?? []) if ((await releaseMilestone(m.id as string, 'auto')).ok) released++;
  return NextResponse.json({ checked: (data ?? []).length, released });
}
