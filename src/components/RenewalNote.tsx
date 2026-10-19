/** Clear auto-renewal disclosure shown next to every subscription button (ROSCA-style plain wording). */
export default function RenewalNote({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-relaxed text-muted ${className}`}>
      Renews automatically at the regular price each month or year until you cancel. Introductory prices last only for the period shown.
      Cancel anytime in Billing; your plan stays active through the period you paid for.
    </p>
  );
}

/** The same disclosure, shown by Stripe right above the Pay button. */
export const RENEWAL_CHECKOUT_MESSAGE =
  'This subscription renews automatically at the regular price each billing period until you cancel. Any introductory price applies only for the period shown above. Cancel anytime in Billing on LanceNest; your plan stays active through the period you paid for.';
