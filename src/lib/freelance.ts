import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { FREELANCE_FEES } from '@/lib/fees';

export const FREE_PROPOSALS_PER_MONTH = 10;
export const CATEGORIES = [
  'HVAC & refrigeration', 'Plumbing', 'Electrical', 'Construction & remodeling', 'Handyman & home repair', 'Roofing & exteriors', 'Landscaping & outdoor',
  'Automotive & diesel', 'Welding & fabrication', 'Moving & hauling', 'Cleaning & property services', 'Security & protection services',
  'Web design & development', 'Software development', 'Cybersecurity', 'IT support & networking', 'Enterprise software (ITSM, ERP, CRM)', 'Data & analytics',
  'Graphic design & branding', 'Photography & video', 'Marketing & social media', 'Writing & editing', 'Proposals & grant writing',
  'Program & project management', 'Logistics & supply chain', 'Consulting & strategy', 'Accounting & bookkeeping', 'Legal & paralegal', 'HR & recruiting',
  'Training & instruction', 'Fitness & coaching', 'Healthcare & medical', 'Aviation & drones', 'Intelligence & analysis', 'Events & hospitality', 'Other'];

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
