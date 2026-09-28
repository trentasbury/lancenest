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
  | 'training_listing_month' | 'training_listing_year' | 'training_featured' | 'training_webinar'
  | 'veteran_pro_month' | 'veteran_pro_year' | 'veteran_pro_plus_month' | 'veteran_pro_plus_year' | 'veteran_federal_month' | 'veteran_federal_year'
  | 'job_slot' | 'job_boost' | 'contact_pack';

/** Single source of truth for what we sell. Prices in cents. */
export const CATALOG: Record<ProductKey, { name: string; amount: number; interval?: 'month' | 'year'; plan?: 'professional' | 'federal' | 'veteran_pro' | 'veteran_pro_plus' | 'veteran_federal_pro' | 'training' | 'training_featured'; audience?: 'veteran'; kind: 'plan' | 'job_slot' | 'job_boost' | 'contact_pack' | 'training_webinar' }> = {
  employer_professional_month: { name: 'LanceNest Professional (monthly)', amount: 24900, interval: 'month', plan: 'professional', kind: 'plan' },
  employer_professional_year: { name: 'LanceNest Professional (annual)', amount: 249000, interval: 'year', plan: 'professional', kind: 'plan' },
  employer_federal_month: { name: 'LanceNest Federal (monthly)', amount: 59900, interval: 'month', plan: 'federal', kind: 'plan' },
  employer_federal_year: { name: 'LanceNest Federal (annual)', amount: 599000, interval: 'year', plan: 'federal', kind: 'plan' },
  veteran_pro_month: { name: 'LanceNest Pro (monthly)', amount: 2500, interval: 'month', plan: 'veteran_pro', audience: 'veteran', kind: 'plan' },
  veteran_pro_year: { name: 'LanceNest Pro (annual)', amount: 25000, interval: 'year', plan: 'veteran_pro', audience: 'veteran', kind: 'plan' },
  veteran_pro_plus_month: { name: 'LanceNest Pro Plus (monthly)', amount: 4500, interval: 'month', plan: 'veteran_pro_plus', audience: 'veteran', kind: 'plan' },
  veteran_pro_plus_year: { name: 'LanceNest Pro Plus (annual)', amount: 45000, interval: 'year', plan: 'veteran_pro_plus', audience: 'veteran', kind: 'plan' },
  veteran_federal_month: { name: 'LanceNest Federal (monthly)', amount: 6500, interval: 'month', plan: 'veteran_federal_pro', audience: 'veteran', kind: 'plan' },
  veteran_federal_year: { name: 'LanceNest Federal (annual)', amount: 65000, interval: 'year', plan: 'veteran_federal_pro', audience: 'veteran', kind: 'plan' },
  training_listing_month: { name: 'Training & Certifications listing (monthly)', amount: 14900, interval: 'month', plan: 'training', kind: 'plan' },
  training_listing_year: { name: 'Training & Certifications listing (annual)', amount: 149000, interval: 'year', plan: 'training', kind: 'plan' },
  training_featured: { name: 'Featured training programs', amount: 9900, interval: 'month', plan: 'training_featured', kind: 'plan' },
  training_webinar: { name: 'Sponsored info session', amount: 50000, kind: 'training_webinar' },
  job_slot: { name: 'Extra open job slot', amount: 3900, interval: 'month', kind: 'job_slot' },
  job_boost: { name: 'Featured job boost (30 days)', amount: 4900, kind: 'job_boost' },
  contact_pack: { name: '5 candidate contact credits', amount: 5900, kind: 'contact_pack' },
};

export const BOOST_DAYS = 30;

export const CONTACT_PACK_SIZE = 5;

/** Founding Employers: first 50 Professional subscribers pay $149/mo (or $1,490/yr) for their first 12 months. */
export const FOUNDING = { spots: 50, months: 12, monthlyOffCents: 10000, annualOffCents: 100000 };

/** Stripe coupons for the founding discount, created once and reused. */
export async function foundingCoupon(interval: 'month' | 'year') {
  const id = interval === 'year' ? 'lancenest-founding-annual-v2' : 'lancenest-founding-monthly-v2';
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

/** Public Safety rate: 30% off Professional/Federal for approved government public-safety agencies. */
export async function publicSafetyCoupon() {
  const id = 'lancenest-public-safety';
  try { await stripe().coupons.retrieve(id); }
  catch { await stripe().coupons.create({ id, name: 'Public Safety rate — 30% off', percent_off: 30, duration: 'forever' }); }
  return id;
}
