import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { FREELANCE_FEES } from '@/lib/fees';

export const FREE_PROPOSALS_PER_MONTH = 10;
export const CATEGORIES = [
  // Federal-ready work leads the brand
  'Cybersecurity', 'IT support & networking', 'Enterprise software (ITSM, ERP, CRM)', 'Software development', 'Data & analytics', 'Intelligence & analysis',
  'Program & project management', 'Proposals & grant writing', 'Logistics & supply chain', 'Consulting & strategy', 'Training & instruction',
  'Security & protection services', 'Aviation & drones', 'Healthcare & medical', 'Accounting & bookkeeping', 'Legal & paralegal', 'HR & recruiting',
  // Creative and marketing
  'Web design & development', 'Graphic design & branding', 'Marketing & social media', 'Writing & editing', 'Photography & video', 'Events & hospitality', 'Fitness & coaching',
  // Skilled trades and on-site services
  'HVAC & refrigeration', 'Electrical', 'Plumbing', 'Construction & remodeling', 'Welding & fabrication', 'Automotive & diesel', 'Roofing & exteriors',
  'Handyman & home repair', 'Landscaping & outdoor', 'Moving & hauling', 'Cleaning & property services', 'Other'];

/** What the veteran keeps from a payment, by plan (percent). */
export function keepPercent(plan: string) {
  return Math.round((1 - (FREELANCE_FEES.veteranRate[plan] ?? FREELANCE_FEES.veteranRate.free)) * 100);
}

export async function proposalsUsedThisMonth(profileId: string) {
  const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { count } = await createClient().from('proposals').select('id', { count: 'exact', head: true }).eq('freelancer_id', profileId).gte('created_at', start);
  return count ?? 0;
}

export const PRICE_LABEL: Record<string, string> = { fixed: '', hourly: '/hr', starting_at: '+' };
export const DELIVERY_LABEL: Record<string, string> = { remote: 'Remote', on_site: 'On-site', both: 'On-site or remote' };
