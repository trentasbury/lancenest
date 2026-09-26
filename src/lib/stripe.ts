import 'server-only';
import Stripe from 'stripe';

export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key);
}

export type ProductKey =
  | 'employer_professional_month' | 'employer_professional_year'
  | 'employer_federal_month' | 'employer_federal_year'
  | 'job_slot' | 'job_boost' | 'contact_pack';

/** Single source of truth for what we sell. Prices in cents. */
export const CATALOG: Record<ProductKey, { name: string; amount: number; interval?: 'month' | 'year'; plan?: 'professional' | 'federal'; kind: 'plan' | 'job_slot' | 'job_boost' | 'contact_pack' }> = {
  employer_professional_month: { name: 'LanceNest Professional (monthly)', amount: 19900, interval: 'month', plan: 'professional', kind: 'plan' },
  employer_professional_year: { name: 'LanceNest Professional (annual)', amount: 199000, interval: 'year', plan: 'professional', kind: 'plan' },
  employer_federal_month: { name: 'LanceNest Federal (monthly)', amount: 49900, interval: 'month', plan: 'federal', kind: 'plan' },
  employer_federal_year: { name: 'LanceNest Federal (annual)', amount: 499000, interval: 'year', plan: 'federal', kind: 'plan' },
  job_slot: { name: 'Extra open job slot', amount: 3900, interval: 'month', kind: 'job_slot' },
  job_boost: { name: 'Featured job boost (30 days)', amount: 4900, kind: 'job_boost' },
  contact_pack: { name: '5 candidate contact credits', amount: 5900, kind: 'contact_pack' },
};

export const BOOST_DAYS = 30;

export const CONTACT_PACK_SIZE = 5;

/** Founding Employers: first 50 Professional subscribers pay $149/mo (or $1,490/yr) for their first 12 months. */
export const FOUNDING = { spots: 50, months: 12, monthlyOffCents: 5000, annualOffCents: 50000 };

/** Stripe coupons for the founding discount, created once and reused. */
export async function foundingCoupon(interval: 'month' | 'year') {
  const id = interval === 'year' ? 'lancenest-founding-annual' : 'lancenest-founding-monthly';
  try {
    await stripe().coupons.retrieve(id);
  } catch {
    await stripe().coupons.create(
      interval === 'year'
        ? { id, name: 'Founding Employer — first year', amount_off: FOUNDING.annualOffCents, currency: 'usd', duration: 'once' }
        : { id, name: 'Founding Employer — first 12 months', amount_off: FOUNDING.monthlyOffCents, currency: 'usd', duration: 'repeating', duration_in_months: FOUNDING.months },
    );
  }
  return id;
}
