import 'server-only';
import Stripe from 'stripe';

export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key);
}

export type ProductKey =
  | 'employer_starter_month' | 'employer_starter_year'
  | 'employer_professional_month' | 'employer_professional_year'
  | 'employer_federal_month' | 'employer_federal_year'
  | 'training_listing_month' | 'training_listing_year' | 'training_featured' | 'training_webinar' | 'fair_booth' | 'fair_booth_member' | 'shortlist' | 'shortlist_member' | 'shortlist_federal' | 'shortlist_federal_credit'
  | 'veteran_pro_month' | 'veteran_pro_year' | 'veteran_pro_plus_month' | 'veteran_pro_plus_year' | 'veteran_federal_month' | 'veteran_federal_year'
  | 'job_slot' | 'job_boost' | 'contact_pack' | 'proposal_pack';

/** Single source of truth for what we sell. Prices in cents. */
export const CATALOG: Record<ProductKey, { name: string; amount: number; interval?: 'month' | 'year'; plan?: 'starter' | 'professional' | 'federal' | 'veteran_pro' | 'veteran_pro_plus' | 'veteran_federal_pro' | 'training' | 'training_featured'; audience?: 'veteran'; kind: 'plan' | 'job_slot' | 'job_boost' | 'contact_pack' | 'training_webinar' | 'fair_booth' | 'shortlist' | 'proposal_pack' }> = {
  employer_starter_month: { name: 'LanceNest Starter (monthly)', amount: 9900, interval: 'month', plan: 'starter', kind: 'plan' },
  employer_starter_year: { name: 'LanceNest Starter (annual)', amount: 99000, interval: 'year', plan: 'starter', kind: 'plan' },
  employer_professional_month: { name: 'LanceNest Professional (monthly)', amount: 24900, interval: 'month', plan: 'professional', kind: 'plan' },
  employer_professional_year: { name: 'LanceNest Professional (annual)', amount: 249000, interval: 'year', plan: 'professional', kind: 'plan' },
  employer_federal_month: { name: 'LanceNest Federal (monthly)', amount: 99900, interval: 'month', plan: 'federal', kind: 'plan' },
  employer_federal_year: { name: 'LanceNest Federal (annual)', amount: 999000, interval: 'year', plan: 'federal', kind: 'plan' },
  veteran_pro_month: { name: 'LanceNest Pro (monthly)', amount: 2500, interval: 'month', plan: 'veteran_pro', audience: 'veteran', kind: 'plan' },
  veteran_pro_year: { name: 'LanceNest Pro (annual)', amount: 19900, interval: 'year', plan: 'veteran_pro', audience: 'veteran', kind: 'plan' },
  veteran_pro_plus_month: { name: 'LanceNest Career Accelerator (monthly)', amount: 3500, interval: 'month', plan: 'veteran_pro_plus', audience: 'veteran', kind: 'plan' },
  veteran_pro_plus_year: { name: 'LanceNest Career Accelerator (annual)', amount: 29900, interval: 'year', plan: 'veteran_pro_plus', audience: 'veteran', kind: 'plan' },
  veteran_federal_month: { name: 'LanceNest Federal (monthly)', amount: 6500, interval: 'month', plan: 'veteran_federal_pro', audience: 'veteran', kind: 'plan' },
  veteran_federal_year: { name: 'LanceNest Federal (annual)', amount: 65000, interval: 'year', plan: 'veteran_federal_pro', audience: 'veteran', kind: 'plan' },
  training_listing_month: { name: 'Training & Certifications listing (monthly)', amount: 14900, interval: 'month', plan: 'training', kind: 'plan' },
  training_listing_year: { name: 'Training & Certifications listing (annual)', amount: 149000, interval: 'year', plan: 'training', kind: 'plan' },
  training_featured: { name: 'Featured training programs', amount: 9900, interval: 'month', plan: 'training_featured', kind: 'plan' },
  training_webinar: { name: 'Sponsored info session', amount: 50000, kind: 'training_webinar' },
  fair_booth: { name: 'Virtual career fair booth', amount: 49900, kind: 'fair_booth' },
  shortlist: { name: 'Search Sprint (up to 5 introductions in 15 business days)', amount: 250000, kind: 'shortlist' },
  shortlist_member: { name: 'Search Sprint (Professional price)', amount: 225000, kind: 'shortlist' },
  shortlist_federal: { name: 'Search Sprint (Federal price)', amount: 200000, kind: 'shortlist' },
  shortlist_federal_credit: { name: 'Search Sprint (Federal, with your yearly $500 credit)', amount: 150000, kind: 'shortlist' },
  fair_booth_member: { name: 'Virtual career fair booth (plan member price)', amount: 39900, kind: 'fair_booth' },
  job_slot: { name: 'Extra open job slot', amount: 3900, interval: 'month', kind: 'job_slot' },
  job_boost: { name: 'Featured job boost (30 days)', amount: 4900, kind: 'job_boost' },
  contact_pack: { name: '10 more new conversations', amount: 5900, kind: 'contact_pack' },
  proposal_pack: { name: '5 extra freelance proposals', amount: 500, audience: 'veteran', kind: 'proposal_pack' },
};

/**
 * The named Stripe product each item is billed under (created in the live LanceNest account on October 31, 2026), so
 * Stripe's reports and receipts show plan names. Prices stay inline: the price a customer starts at is what renews.
 */
const STRIPE_PRODUCT: Record<ProductKey, string> = {
  employer_starter_month: 'ln_employer_starter', employer_starter_year: 'ln_employer_starter',
  employer_professional_month: 'ln_employer_professional', employer_professional_year: 'ln_employer_professional',
  employer_federal_month: 'ln_employer_federal', employer_federal_year: 'ln_employer_federal',
  veteran_pro_month: 'ln_member_pro', veteran_pro_year: 'ln_member_pro',
  veteran_pro_plus_month: 'ln_member_career_accelerator', veteran_pro_plus_year: 'ln_member_career_accelerator',
  veteran_federal_month: 'ln_member_federal', veteran_federal_year: 'ln_member_federal',
  training_listing_month: 'ln_training_listing', training_listing_year: 'ln_training_listing',
  training_featured: 'ln_training_featured', training_webinar: 'ln_training_webinar',
  fair_booth: 'ln_fair_booth', fair_booth_member: 'ln_fair_booth',
  shortlist: 'ln_search_sprint', shortlist_member: 'ln_search_sprint', shortlist_federal: 'ln_search_sprint', shortlist_federal_credit: 'ln_search_sprint',
  job_slot: 'ln_job_slot', job_boost: 'ln_job_boost', contact_pack: 'ln_extra_conversations', proposal_pack: 'ln_proposal_pack',
};

/** One checkout line for a catalog item, billed under its named Stripe product. */
export function catalogLine(key: ProductKey): Stripe.Checkout.SessionCreateParams.LineItem {
  const item = CATALOG[key];
  return { quantity: 1, price_data: { currency: 'usd', unit_amount: item.amount, product: STRIPE_PRODUCT[key], ...(item.interval ? { recurring: { interval: item.interval } } : {}) } };
}

/**
 * Starts a Checkout Session. If the Stripe account in use doesn't have LanceNest's named products (a test or older
 * account), it retries with the item described inline, so checkout never breaks over a missing product.
 */
export async function createCheckout(params: Stripe.Checkout.SessionCreateParams) {
  try {
    return await stripe().checkout.sessions.create(params);
  } catch (err) {
    const e = err as { code?: string; param?: string };
    if (e.code !== 'resource_missing' || !String(e.param ?? '').includes('product')) throw err;
    const names = new Map(Object.entries(STRIPE_PRODUCT).map(([k, id]) => [id, CATALOG[k as ProductKey].name]));
    return stripe().checkout.sessions.create({
      ...params,
      line_items: params.line_items?.map((li) => {
        if (!li.price_data?.product) return li;
        const { product, ...rest } = li.price_data;
        return { ...li, price_data: { ...rest, product_data: { name: names.get(product) ?? 'LanceNest' } } };
      }),
    });
  }
}

/** Free freelancers: proposals added per pack (they never expire). */
export const PROPOSAL_PACK_SIZE = 5;

export const BOOST_DAYS = 30;

export const CONTACT_PACK_SIZE = 10;

/**
 * Founding Employers (first 50 companies, once each): Starter $69/mo or $690/yr, Professional $149/mo or $1,490/yr,
 * for the first 12 months; Federal $7,500 for the first year (annual). Then the standard price.
 */
export const FOUNDING = { spots: 50, months: 12, monthlyOffCents: 10000, annualOffCents: 100000 };
export const FOUNDING_FEDERAL = { monthlyOffCents: 0, annualOffCents: 249000 };   // $9,990 - $2,490 = $7,500 first year, paid up front
export const FOUNDING_STARTER = { monthlyOffCents: 3000, annualOffCents: 30000 }; // $99 -> $69/mo; $990 -> $690/yr

/** Founding Members (first 100 verified members): 6 months of Pro free, then $99 for their first year of Pro (annual). */
export const FOUNDING_MEMBER = { spots: 100, freeDays: 180, annualOffCents: 10000 };     // $199 -> $99 first year

export async function foundingStarterCoupon(interval: 'month' | 'year') {
  const id = interval === 'year' ? 'lancenest-founding-starter-annual' : 'lancenest-founding-starter-monthly';
  try { return (await stripe().coupons.retrieve(id)).id; } catch {
    return (await stripe().coupons.create(interval === 'year'
      ? { id, name: 'Founding Employer — Starter first year', amount_off: FOUNDING_STARTER.annualOffCents, currency: 'usd', duration: 'once' }
      : { id, name: 'Founding Employer — Starter first 12 months', amount_off: FOUNDING_STARTER.monthlyOffCents, currency: 'usd', duration: 'repeating', duration_in_months: FOUNDING.months })).id;
  }
}

export async function foundingMemberCoupon() {
  const id = 'lancenest-founding-member-pro-year';
  try { return (await stripe().coupons.retrieve(id)).id; } catch {
    return (await stripe().coupons.create({ id, name: 'Founding Member — Pro first year $99', amount_off: FOUNDING_MEMBER.annualOffCents, currency: 'usd', duration: 'once' })).id;
  }
}

/** Stripe coupons for the founding discount, created once and reused. */
export async function foundingFederalCoupon(interval: 'month' | 'year') {
  const id = interval === 'year' ? 'lancenest-founding-federal-annual-v3' : 'lancenest-founding-federal-monthly-v3';
  try { return (await stripe().coupons.retrieve(id)).id; } catch {
    return (await stripe().coupons.create(interval === 'year'
      ? { id, name: 'Founding Employer — Federal first year', amount_off: FOUNDING_FEDERAL.annualOffCents, currency: 'usd', duration: 'once' }
      : { id, name: 'Founding Employer — Federal first 12 months', amount_off: FOUNDING_FEDERAL.monthlyOffCents, currency: 'usd', duration: 'repeating', duration_in_months: FOUNDING.months })).id;
  }
}

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

/** Keep Pro: 25% off the first year of a member plan, offered when free transition or partner Pro ends. */
export const KEEP_PRO_PERCENT = 25;
export async function keepProCoupon() {
  const id = 'lancenest-keep-pro-25';
  try { await stripe().coupons.retrieve(id); }
  catch { await stripe().coupons.create({ id, name: 'Keep Pro — 25% off your first year', percent_off: KEEP_PRO_PERCENT, duration: 'once' }); }
  return id;
}
