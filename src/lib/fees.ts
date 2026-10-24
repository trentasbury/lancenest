/** Freelance marketplace fees — single source of truth for when the marketplace launches. */
export const FREELANCE_FEES = {
  veteranRate: { free: 0.1, pro: 0.07, pro_plus: 0.05, federal_pro: 0.04 } as Record<string, number>, // veterans keep at least 90%
  foundingFreelancerRate: 0.03, // first 20 freelancers, for 6 months
  clientRate: { card: 0.05, bank: 0.03 }, // bank transfers cost LanceNest 0.8% (max $5) vs ~3% for cards
  contractStartCents: 999, // per new contract, paid by the client (Upwork charges up to $14.99)
  smallProjectCents: 0, // on projects under $200 (Fiverr charges $3.50)
  smallProjectUnderCents: 20000,
  conversionFee: { minimumCents: 500000, firstYearPayRate: 0.15 }, // hiring a freelancer full-time
  // Booking fee: paid by the client to LanceNest when they hire (veterans pay nothing). Collected before the job is
  // booked, so it can't be skipped by paying the freelancer in cash. Roughly 1–5% of the job, capped at $99.99.
  bookingTiers: [
    { underCents: 20000, feeCents: 499 },   // under $200
    { underCents: 50000, feeCents: 999 },   // $200–499
    { underCents: 100000, feeCents: 1999 }, // $500–999
    { underCents: 250000, feeCents: 3999 }, // $1,000–2,499
    { underCents: 500000, feeCents: 6999 }, // $2,500–4,999
    { underCents: Infinity, feeCents: 9999 }, // $5,000 and up (cap)
  ],
};
