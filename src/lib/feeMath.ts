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

/** The client's booking fee for a job of this price: 5% of it, at least $4.99 and at most $249. */
export function bookingFeeCents(priceCents: number) {
  const { bookingRate, bookingMinCents, bookingMaxCents } = FREELANCE_FEES;
  return Math.min(Math.max(Math.round(Math.max(priceCents, 0) * bookingRate), bookingMinCents), bookingMaxCents);
}

/** Plain-English examples for pages: [job price, fee]. */
export function bookingFeeTable(): [string, string][] {
  const usd = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0 })}`;
  return [5000, 40000, 150000, 300000, 600000, 1500000].map((c) => [usd(c), usd(bookingFeeCents(c))]);
}
