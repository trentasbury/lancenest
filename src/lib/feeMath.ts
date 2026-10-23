import { FREELANCE_FEES } from '@/lib/fees';

/**
 * What the client pays for a milestone. The contract-start and small-project fees apply once, on the contract's first
 * funded milestone, unless the client already paid a booking fee for this contract (that replaces the contract-start fee).
 */
export function feeBreakdown(amountCents: number, method: 'card' | 'bank', firstPayment: boolean, contractTotalCents: number, bookingPaid = false) {
  const clientFee = Math.round(amountCents * FREELANCE_FEES.clientRate[method]);
  const contractFee = firstPayment && !bookingPaid ? FREELANCE_FEES.contractStartCents : 0;
  const smallFee = firstPayment && !bookingPaid && contractTotalCents < FREELANCE_FEES.smallProjectUnderCents ? FREELANCE_FEES.smallProjectCents : 0;
  return { clientFee, platformFee: contractFee + smallFee, total: amountCents + clientFee + contractFee + smallFee };
}

/** The client's booking fee for a job of this price (tiers in lib/fees.ts). */
export function bookingFeeCents(priceCents: number) {
  const tier = FREELANCE_FEES.bookingTiers.find((t) => priceCents < t.underCents) ?? FREELANCE_FEES.bookingTiers[FREELANCE_FEES.bookingTiers.length - 1];
  return tier.feeCents;
}

/** Plain-English fee table for pages: [job price, fee]. */
export function bookingFeeTable(): [string, string][] {
  const usd = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0 })}`;
  let from = 0;
  return FREELANCE_FEES.bookingTiers.map((t) => {
    const row: [string, string] = [t.underCents === Infinity ? `${usd(from)} and up` : from === 0 ? `Under ${usd(t.underCents)}` : `${usd(from)}–${usd(t.underCents - 100)}`, usd(t.feeCents)];
    from = t.underCents;
    return row;
  });
}
