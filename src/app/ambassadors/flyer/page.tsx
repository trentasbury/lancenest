import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { requireVerifiedMember } from '@/lib/auth';
import { isActiveAmbassador } from '@/lib/ambassadors';
import { SITE } from '@/lib/email';
import PrintButton from '@/components/PrintButton';

export const metadata: Metadata = { title: 'Your ambassador flyer', robots: { index: false } };

export default async function FlyerPage() {
  const { user, profile } = await requireVerifiedMember('/ambassadors/flyer');
  if (!(await isActiveAmbassador(user.id)) || !profile.username) redirect('/ambassadors');
  const link = `${SITE}/signup?ref=${profile.username}`;
  const svg = await QRCode.toString(link, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#102431', light: '#ffffff' } });
  return (
    <div className="container-page max-w-3xl py-8">
      <div className="mb-6 flex items-center justify-between print:hidden"><p className="text-sm text-muted">Letter size. Choose “Save as PDF” or print.</p><PrintButton label="Print flyer" /></div>
      <article className="mx-auto flex aspect-[8.5/11] max-w-[680px] flex-col items-center justify-between rounded-xl border border-line bg-white p-12 text-center print:rounded-none print:border-0">
        <div>
          <p className="font-serif text-3xl font-semibold tracking-wordmark text-navy">LANCENEST</p>
          <p className="mt-2 text-sm uppercase tracking-[0.2em] text-brass-dark">The verified career network for people who served</p>
        </div>
        <div>
          <h1 className="font-serif text-5xl font-medium leading-tight text-ink">Getting out?<br />Start your job search here.</h1>
          <ul className="mx-auto mt-6 max-w-md space-y-2 text-left text-[17px] text-ink/85">
            <li>✓ Jobs from employers that hire veterans</li>
            <li>✓ Your MOS, rating or AFSC translated into civilian jobs</li>
            <li>✓ Free for service members, veterans and spouses</li>
            <li>✓ 90 days of Pro free if you separate within a year</li>
          </ul>
        </div>
        <div className="flex flex-col items-center">
          <div className="h-44 w-44 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="mt-3 text-sm text-ink/80">Scan to join, or go to <strong>lancenest.com</strong></p>
          <p className="mt-1 text-xs text-muted">Shared by {profile.full_name}, LanceNest Ambassador. Not affiliated with or endorsed by the DoD or any branch.</p>
        </div>
      </article>
    </div>
  );
}
