import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

export const COMMISSION_PERCENT_FREE = Number(process.env.COMMISSION_PERCENT_FREE || 15);
export const COMMISSION_PERCENT_PRO = Number(process.env.COMMISSION_PERCENT_PRO || 10);
