/** Small badge for paid member plans, shown next to the green verified check. */
export default function PlanBadge({ plan }: { plan?: string | null }) {
  const label = plan === 'federal_pro' ? 'Federal' : plan === 'pro_plus' ? 'Pro Plus' : plan === 'pro' ? 'Pro' : null;
  if (!label) return null;
  const tone = plan === 'federal_pro' ? 'border-navy bg-navy text-brass' : plan === 'pro_plus' ? 'border-brass bg-brass/15 text-brass-dark' : 'border-brass/60 text-brass-dark';
  return <span className={`ml-1.5 inline-block rounded-full border px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-[0.1em] ${tone}`}>{label}</span>;
}
