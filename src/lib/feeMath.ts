import { FREELANCE_FEES } from '@/lib/fees';

/** What the client pays for a milestone. Contract-start and small-project fees apply once, on the contract's first funded milestone. */
export function feeBreakdown(amountCents: number, method: 'card' | 'bank', firstPayment: boolean, contractTotalCents: number) {
  const clientFee = Math.round(amountCents * FREELANCE_FEES.clientRate[method]);
  const contractFee = firstPayment ? FREELANCE_FEES.contractStartCents : 0;
  const smallFee = firstPayment && contractTotalCents < FREELANCE_FEES.smallProjectUnderCents ? FREELANCE_FEES.smallProjectCents : 0;
  return { clientFee, platformFee: contractFee + smallFee, total: amountCents + clientFee + contractFee + smallFee };
}
