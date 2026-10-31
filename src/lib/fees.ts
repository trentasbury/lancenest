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
  // booked and before contact details open, so it can't be skipped by paying the freelancer in cash. 5% of the agreed
  // price, at least $4.99 and at most $249 (approved October 31, 2026).
  bookingRate: 0.05,
  bookingMinCents: 499,
  bookingMaxCents: 24900,
};
