const COPY: Record<string, { label: string; tone: string }> = {
  verified: { label: 'Verified Veteran', tone: 'border-olive/40 bg-olive/10 text-olive' },
  pending: { label: 'Verification Pending', tone: 'border-brass/50 bg-brass/10 text-brass-dark' },
  failed: { label: 'Verification Needs Attention', tone: 'border-signal/30 bg-signal/5 text-signal' },
  not_verified: { label: 'Not Yet Verified', tone: 'border-line bg-paper text-muted' },
};

export default function VerificationBadge({ status }: { status: string }) {
  const c = COPY[status] ?? COPY.not_verified;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${c.tone}`}>
      {status === 'verified' && <span aria-hidden="true">✦</span>}
      {c.label}
    </span>
  );
}
