import VerifiedMark from './VerifiedMark';

/** Verification status pill. Verified members get the green check used across the site. */
export default function VerificationBadge({ status }: { status: string }) {
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center rounded-full border border-[#2f7a3e]/40 bg-[#2f7a3e]/10 py-1 pl-0.5 pr-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2f7a3e]">
        <VerifiedMark /> <span className="ml-1">Verified service member</span>
      </span>
    );
  }
  const label = status === 'pending' ? 'Verification pending' : status === 'failed' ? 'Not verified' : 'Unverified';
  const tone = status === 'pending' ? 'border-brass/60 bg-brass/10 text-brass-dark' : 'border-line bg-cream text-muted';
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${tone}`}>{label}</span>;
}
