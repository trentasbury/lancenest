import SubmitButton from '@/components/SubmitButton';
import { redeemCode } from '@/app/dashboard/partnerActions';
import { REDEEM_MESSAGES, type RedeemResult } from '@/lib/partnerCodes';

/** "Have a partner code?" A transition office, veterans' group or nonprofit may have given the member one. */
export default function PartnerCodeForm({ back, result, prefill }: { back: '/plans' | '/dashboard'; result?: string; prefill?: string }) {
  const msg = result && result in REDEEM_MESSAGES ? REDEEM_MESSAGES[result as RedeemResult] : null;
  return (
    <form action={redeemCode.bind(null, back)} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor="partner-code" className="field-label">{prefill ? 'Your partner code is ready' : 'Have a partner code?'}</label>
        <input id="partner-code" name="code" defaultValue={prefill} required maxLength={32} placeholder="e.g. TAP-LEJEUNE" className="field uppercase" />
        <p className="mt-1 text-xs text-muted">From a transition office, veterans’ group or nonprofit. Adds free months of Pro to a verified account.</p>
        {msg && <p role="status" className={`mt-2 text-sm ${result === 'ok' ? 'text-olive' : 'text-signal'}`}>{msg}</p>}
      </div>
      <SubmitButton className="btn btn-outline shrink-0" pendingText="Checking…">Apply code</SubmitButton>
    </form>
  );
}
