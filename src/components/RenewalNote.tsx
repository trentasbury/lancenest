/** Clear auto-renewal disclosure shown next to every subscription button (ROSCA-style plain wording). */
export default function RenewalNote({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-relaxed text-muted ${className}`}>
      Renews automatically at the regular price each month or year until you cancel, and that price is locked: it won’t go up while you stay subscribed.
      Introductory prices last only for the period shown. Switching plans? The old one stops and its unused time is credited. Cancel anytime in Billing.
    </p>
  );
}

/** The same disclosure, shown by Stripe right above the Pay button. */
export const RENEWAL_CHECKOUT_MESSAGE =
  'This subscription renews automatically at the regular price each billing period until you cancel, and that regular price is locked while you stay subscribed. Any introductory price applies only for the period shown above. If this replaces a plan you already have, the old plan stops and its unused time is credited. Cancel anytime in Billing on LanceNest.';
