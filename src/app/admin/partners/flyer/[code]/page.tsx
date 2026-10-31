import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE } from '@/lib/email';
import PrintButton from '@/components/PrintButton';
import LogoMark from '@/components/LogoMark';

export const metadata: Metadata = { title: 'Partner flyer', robots: { index: false } };

/** A one-page, letter-size flyer for a base, transition office or veterans' program to post or hand out. */
export default async function PartnerFlyerPage(props: { params: Promise<{ code: string }> }) {
  await requireAdmin('/admin/partners');
  const { code: raw } = await props.params;
  const code = decodeURIComponent(raw).trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,32}$/.test(code)) notFound();
  const { data: pc } = await createAdminClient().from('partner_codes').select('code, partner_name, months, expires_at, active').eq('code', code).maybeSingle();
  if (!pc) notFound();
  const link = `${SITE}/partner/${encodeURIComponent(code)}`;
  const svg = await QRCode.toString(link, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#102431', light: '#ffffff' } });
  const months = pc.months as number;
  const length = months === 12 ? '1 year' : `${months} months`;
  const expires = pc.expires_at ? new Date(pc.expires_at as string).toLocaleDateString('en-US', { dateStyle: 'long' }) : null;
  return (
    <div className="container-page max-w-3xl py-8">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <p className="text-sm text-muted">Letter size, for {pc.partner_name as string}. Choose “Save as PDF” or print.{pc.active ? '' : ' This code is turned off: turn it on before handing the flyer out.'}</p>
        <PrintButton label="Print flyer" />
      </div>
      <article className="mx-auto flex aspect-[8.5/11] max-w-[680px] flex-col items-center justify-between rounded-xl border border-line bg-white p-12 text-center print:rounded-none print:border-0">
        <div className="flex flex-col items-center">
          <LogoMark className="h-12 w-[76px]" />
          <p className="mt-3 font-serif text-3xl font-semibold tracking-wordmark text-navy">LANCENEST</p>
          <p className="mt-1 text-sm uppercase tracking-[0.2em] text-brass-dark">Built by veterans, for veterans</p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brass-dark">Courtesy of {pc.partner_name as string}</p>
          <h1 className="mt-3 font-serif text-5xl font-medium leading-tight text-ink">{length} of LanceNest Pro,<br />free.</h1>
          <ul className="mx-auto mt-6 max-w-md space-y-2 text-left text-[17px] text-ink/85">
            <li>✓ Jobs from verified employers that hire veterans</li>
            <li>✓ Your MOS, rating or AFSC translated into civilian jobs</li>
            <li>✓ See who viewed your profile, plus job alerts and applicant insights</li>
            <li>✓ Unlimited freelance proposals, from mechanic work to web design</li>
          </ul>
        </div>
        <div className="flex flex-col items-center">
          <div className="h-44 w-44 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="mt-3 text-sm text-ink/80">Scan to join, or go to <strong>lancenest.com</strong> and enter code <strong className="font-mono">{code}</strong></p>
          <p className="mt-1 text-xs text-muted">For verified service members, veterans and military spouses. One code per member. No card needed{expires ? `. Use by ${expires}` : ''}.</p>
          <p className="mt-1 text-xs text-muted">Not affiliated with or endorsed by the DoD or any branch of service.</p>
        </div>
      </article>
    </div>
  );
}
