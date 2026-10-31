import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE } from '@/lib/email';
import PrintButton from '@/components/PrintButton';
import LogoMark from '@/components/LogoMark';

export const metadata: Metadata = { title: 'Print partner cards', robots: { index: false } };

const PER_PAGE = 8;

/** Letter-size sheets of one-time cards (8 per page, 2 across): cut along the lines and hand one to each member. */
export default async function PartnerCardsPage(props: { params: Promise<{ id: string }> }) {
  await requireAdmin('/admin/partners');
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const admin = createAdminClient();
  const { data: batch } = await admin.from('partner_batches').select('id, partner_name, months, transition_only, expires_at, voided_at').eq('id', id).maybeSingle();
  if (!batch) notFound();
  // Only cards that still work: not used, not turned off.
  const { data: codes } = await admin.from('partner_codes').select('code').eq('batch_id', id).eq('uses', 0).eq('active', true).order('code').limit(500);
  const cards = await Promise.all((codes ?? []).map(async ({ code }) => ({
    code: code as string,
    svg: await QRCode.toString(`${SITE}/partner/${encodeURIComponent(code as string)}`, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#102431', light: '#ffffff' } }),
  })));
  const months = batch.months as number;
  const length = months === 12 ? '1 year' : `${months} months`;
  const useBy = new Date(batch.expires_at as string).toLocaleDateString('en-US', { dateStyle: 'medium' });
  const pages: (typeof cards)[] = [];
  for (let i = 0; i < cards.length; i += PER_PAGE) pages.push(cards.slice(i, i + PER_PAGE));
  const done = batch.voided_at || Date.parse(batch.expires_at as string) < Date.now();

  return (
    <div className="container-page max-w-4xl py-8 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link href="/admin/partners" className="text-sm text-muted hover:text-navy">← Partner cards</Link>
          <p className="mt-1 text-sm text-muted">{batch.partner_name as string}: {cards.length} unused cards on {pages.length} letter page{pages.length === 1 ? '' : 's'}. Print at 100% scale, cut along the dashed lines, and hand one card to each member.{done ? ' This batch is voided or expired, so these cards no longer work.' : ''}</p>
        </div>
        {!done && cards.length > 0 && <PrintButton label="Print cards" />}
      </div>
      {pages.map((page, p) => (
        <section key={p} className="mx-auto mb-8 grid w-[7.5in] max-w-full grid-cols-2 gap-0 bg-white print:mb-0 print:break-after-page">
          {page.map((c) => (
            <article key={c.code} className="flex h-[2.4in] items-center gap-3 border border-dashed border-line p-4">
              <div className="h-[1.35in] w-[1.35in] shrink-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: c.svg }} />
              <div className="min-w-0 text-left">
                <div className="flex items-center gap-1.5"><LogoMark className="h-4 w-[26px]" /><span className="font-serif text-sm font-semibold tracking-wordmark text-navy">LANCENEST</span></div>
                <p className="mt-1.5 font-serif text-xl font-medium leading-tight text-ink">{length} of Pro, free</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-brass-dark">Courtesy of {batch.partner_name as string}</p>
                <p className="mt-2 font-mono text-[15px] font-semibold text-navy">{c.code}</p>
                <p className="mt-1 text-[9px] leading-snug text-muted">
                  Scan, or enter the code at lancenest.com. One-time code for one verified {batch.transition_only ? 'service member leaving the service within 12 months' : 'service member, veteran or military spouse'}. Use by {useBy}. Not affiliated with or endorsed by the DoD.
                </p>
              </div>
            </article>
          ))}
        </section>
      ))}
      {cards.length === 0 && <p className="card p-6 text-sm text-muted">No unused cards left in this batch. Make a new batch on the Partner cards page.</p>}
    </div>
  );
}
