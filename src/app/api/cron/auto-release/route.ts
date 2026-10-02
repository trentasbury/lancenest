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
  // Heads-up 3 days before auto-release so clients can approve, request changes, or open a dispute in time.
  const admin = createAdminClient();
  const soonFrom = new Date(Date.now() + 2 * 86400000).toISOString(), soonTo = new Date(Date.now() + 3 * 86400000).toISOString();
  const { data: soon } = await admin.from('milestones').select('id, title, amount_cents, contract:contracts(id, title, client_id)').eq('status', 'submitted').eq('release_notice_sent', false).gt('auto_release_at', soonFrom).lte('auto_release_at', soonTo).limit(200);
  const { notifyMember, SITE } = await import('@/lib/email');
  let notified = 0;
  for (const m of (soon ?? []) as unknown as { id: string; title: string; amount_cents: number; contract: { id: string; title: string; client_id: string } | null }[]) {
    if (!m.contract) continue;
    await notifyMember(m.contract.client_id, { type: 'milestone', link: `/freelance/contracts/${m.contract.id}`, title: `“${m.title}” releases automatically in 3 days. Approve, request changes, or open a dispute before then.`,
      email: { subject: `Action needed: “${m.title}” releases in 3 days`, preheader: 'Approve, request changes, or open a dispute.', tone: 'notice', badge: 'Payment reminder',
        heading: 'A held payment releases in 3 days.', paragraphs: [`Work on “${m.title}” (${m.contract.title}) was submitted for your review. If you take no action, the payment releases to the freelancer automatically in 3 days.`, 'Approve it now, request changes, or open a dispute if something is wrong.'],
        cta: { label: 'Review the work', url: `${SITE}/freelance/contracts/${m.contract.id}` } } });
    await admin.from('milestones').update({ release_notice_sent: true }).eq('id', m.id);
    notified++;
  }
  return NextResponse.json({ checked: (data ?? []).length, released, notified });
}
