import Link from 'next/link';
import { AGREEMENT_FIELD, PLATFORM_AGREEMENT, type AgreementSide } from '@/lib/platformAgreement';

/** The one-time "book it on LanceNest" checkbox, placed inside a form. Required, so the form can't be sent without it. */
export default function AgreementBox({ side, className = '' }: { side: AgreementSide; className?: string }) {
  return (
    <label className={`flex items-start gap-2 rounded-xl border border-brass/50 bg-brass/10 p-3 text-sm text-ink/90 ${className}`}>
      <input type="checkbox" name={AGREEMENT_FIELD} required className="mt-1 accent-navy" />
      <span>{PLATFORM_AGREEMENT[side].text} <Link href="/terms" className="text-navy underline">Terms</Link> · <span className="text-muted">You only agree once.</span></span>
    </label>
  );
}
