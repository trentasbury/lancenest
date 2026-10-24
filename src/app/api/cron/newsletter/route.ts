import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NEWSLETTER_SENDING } from '@/lib/newsletter';
import { listPublicJobs } from '@/lib/publicJobs';
import { formatSalary } from '@/lib/format';
import { SITE, sendEmail } from '@/lib/email';
import { unsubscribeLinks } from '@/lib/emailLinks';
import { GUIDES } from '@/lib/guides';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Weekly (Vercel Cron, Tuesdays): the public jobs newsletter. Skips a week with no new public jobs. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new NextResponse('Unauthorized', { status: 401 });
  if (!NEWSLETTER_SENDING) return NextResponse.json({ ok: true, skipped: 'no mailing address set' });
  const weekAgo = Date.now() - 7 * 86400000;
  const { jobs } = await listPublicJobs(1, 30);
  const fresh = jobs.filter((j) => Date.parse(j.posted_at) >= weekAgo).slice(0, 8);
  if (!fresh.length) return NextResponse.json({ ok: true, skipped: 'no new jobs' });
  const lines = fresh.map((j) => `• ${j.title}${j.location ? ` · ${j.location}` : j.work_arrangement === 'remote' ? ' · Remote' : ''}${formatSalary(j.salary_min, j.salary_max, j.salary_period) ? ` · ${formatSalary(j.salary_min, j.salary_max, j.salary_period)}` : ''}`);
  const guide = GUIDES[Math.floor(Date.now() / (7 * 86400000)) % GUIDES.length];

  const admin = createAdminClient();
  // This week's sponsored employer, if one is scheduled: clearly labeled, one per issue.
  const today = new Date().toISOString().slice(0, 10);
  const { data: sp } = await admin.from('newsletter_sponsors').select('headline, body, company:companies!inner(slug, name, is_verified)').eq('issue_date', today).maybeSingle();
  const sponsor = sp as unknown as { headline: string; body: string; company: { slug: string; name: string; is_verified: boolean } } | null;
  const sponsorLine = sponsor?.company.is_verified ? [`Sponsored · ${sponsor.company.name}: ${sponsor.headline}. ${sponsor.body} (${SITE}/companies/${sponsor.company.slug})`] : [];
  const started = Date.now();
  let sent = 0;
  const { data: subs } = await admin.from('newsletter_subscribers').select('id, email').eq('status', 'active')
    .or(`last_sent_at.is.null,last_sent_at.lt.${new Date(Date.now() - 5 * 86400000).toISOString()}`).limit(500);
  for (const s of subs ?? []) {
    if (Date.now() - started > 50000) break;
    await sendEmail(s.email as string, {
      subject: `${fresh.length} new job${fresh.length === 1 ? '' : 's'} for veterans this week`, preheader: fresh[0].title, tone: 'notice', badge: 'This week on LanceNest',
      heading: 'New jobs from verified employers', paragraphs: [...lines, ...sponsorLine, `Guide of the week: ${guide.title} (${SITE}/guides/${guide.slug})`, 'Employer names and applications are for verified members. Joining is free.'],
      cta: { label: 'See the jobs', url: `${SITE}/open-jobs` },
      unsubscribe: { ...unsubscribeLinks(SITE, s.id as string, 'newsletter'), reason: 'You’re getting this because you subscribed to the LanceNest jobs newsletter.' },
    });
    await admin.from('newsletter_subscribers').update({ last_sent_at: new Date().toISOString() }).eq('id', s.id);
    sent++;
  }
  return NextResponse.json({ ok: true, sent });
}
