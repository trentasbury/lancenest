/** Freelance marketplace fees — single source of truth for when the marketplace launches. */
export const FREELANCE_FEES = {
  veteranRate: { free: 0.15, pro: 0.1, federal_pro: 0.08 } as Record<string, number>,
  foundingFreelancerRate: 0.05, // first 20 freelancers, for 6 months
  clientRate: { card: 0.05, bank: 0.03 }, // bank transfers cost LanceNest 0.8% (max $5) vs ~3% for cards
  contractStartCents: 499, // per new contract (Upwork charges up to $14.99)
  smallProjectCents: 250, // on projects under $200 (Fiverr charges $3.50)
  smallProjectUnderCents: 20000,
  conversionFee: { minimumCents: 500000, firstYearPayRate: 0.15 }, // hiring a freelancer full-time
};
