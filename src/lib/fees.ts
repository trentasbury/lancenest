/** Freelance marketplace fees — single source of truth for when the marketplace launches. */
export const FREELANCE_FEES = {
  veteranRate: { free: 0.1, pro: 0.07, pro_plus: 0.05, federal_pro: 0.04 } as Record<string, number>, // veterans keep at least 90%
  foundingFreelancerRate: 0.03, // first 20 freelancers, for 6 months
  clientRate: { card: 0.05, bank: 0.03 }, // bank transfers cost LanceNest 0.8% (max $5) vs ~3% for cards
  contractStartCents: 999, // the largest contract-start fee (contracts of $1,000 or more); see contractStartTiers
  // Contract-start fee by contract size, paid once by the client (approved October 31, 2026): $0 under $100,
  // $4.99 from $100 to $999.99, $9.99 from $1,000. Upwork charges $0.99 to $14.99.
  contractStartTiers: [[10000, 0], [100000, 499], [Infinity, 999]] as [number, number][],
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
