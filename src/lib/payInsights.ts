import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Pay insights from the pay ranges employers post on LanceNest (last 12 months, verified employers only).
 * A group is shown only with at least MIN_JOBS jobs from at least MIN_COMPANIES different employers, so no single
 * employer's pay can be read off the page.
 */
export const MIN_JOBS = 5;
export const MIN_COMPANIES = 3;

const FAMILIES: [string, RegExp][] = [
  ['Cybersecurity', /\b(cyber|security analyst|soc\b|infosec|information security|isso|issm|penetration|red team|blue team|threat)/i],
  ['Software & data', /\b(software|developer|engineer.*(software|data|devops|cloud)|devops|data (scientist|engineer|analyst)|full[- ]stack|front[- ]end|back[- ]end|machine learning|ai\b)/i],
  ['IT & networks', /\b(it\b|help ?desk|network|system(s)? admin|sysadmin|desktop support|technical support|cloud|infrastructure)/i],
  ['Intelligence & analysis', /\b(intel|intelligence|all[- ]source|targeting|geoint|sigint|humint|analyst)\b/i],
  ['Program & project management', /\b(program manager|project manager|pmo|scrum|product manager|program analyst)/i],
  ['Logistics & supply chain', /\b(logistic|supply|warehouse|inventory|procurement|fleet|transportation|dispatch|distribution)/i],
  ['Operations & management', /\b(operations|manager|supervisor|director|lead\b|superintendent)/i],
  ['Maintenance & technicians', /\b(mechanic|technician|maintenance|avionics|a&p|electronics tech|field service)/i],
  ['Skilled trades', /\b(electrician|hvac|plumb|welder|carpenter|construction|lineman|machinist)/i],
  ['Security & law enforcement', /\b(security officer|guard|police|law enforcement|protective|investigator|corrections)/i],
  ['Healthcare', /\b(nurse|medic|emt|paramedic|medical|health|pharmac|clinical|therap)/i],
  ['Sales & business development', /\b(sales|business development|account (manager|executive)|capture)/i],
  ['HR, training & recruiting', /\b(recruit|human resources|hr\b|talent|trainer|instructor|training)/i],
  ['Finance & contracts', /\b(finance|accountant|accounting|contracts?|budget|financial|auditor)/i],
];

const CLEARANCE_GROUP: Record<string, string> = { none: 'No clearance', public_trust: 'Public Trust', confidential: 'Secret or Confidential', secret: 'Secret or Confidential', top_secret: 'Top Secret', ts_sci: 'TS/SCI' };
const CLEARANCE_ORDER = ['No clearance', 'Public Trust', 'Secret or Confidential', 'Top Secret', 'TS/SCI'];

export type PayGroup = { name: string; jobs: number; companies: number; low: number; mid: number; high: number };

function familyOf(title: string) {
  return FAMILIES.find(([, re]) => re.test(title))?.[0] ?? null;
}
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const round = (n: number) => Math.round(n / 1000) * 1000;

type Row = { title: string; salary_min: number | null; salary_max: number | null; salary_period: string; clearance_required: string; company_id: string };

function summarize(name: string, rows: Row[]): PayGroup | null {
  const companies = new Set(rows.map((r) => r.company_id)).size;
  if (rows.length < MIN_JOBS || companies < MIN_COMPANIES) return null;
  const yearly = (n: number, period: string) => (period === 'hour' ? n * 2080 : n);
  const lows = rows.map((r) => yearly(r.salary_min ?? r.salary_max!, r.salary_period));
  const highs = rows.map((r) => yearly(r.salary_max ?? r.salary_min!, r.salary_period));
  return { name, jobs: rows.length, companies, low: round(median(lows)), mid: round(median(rows.map((_, i) => (lows[i] + highs[i]) / 2))), high: round(median(highs)) };
}

export async function payInsights(): Promise<{ families: PayGroup[]; clearance: PayGroup[]; total: number; since: string }> {
  const since = new Date(Date.now() - 365 * 86400000).toISOString();
  const rows: Row[] = [];
  const admin = createAdminClient();
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await admin.from('jobs')
      .select('title, salary_min, salary_max, salary_period, clearance_required, company_id, company:companies!inner(is_verified, owner_id)')
      .gte('posted_at', since).neq('employment_type', 'skillbridge').or('salary_min.not.is.null,salary_max.not.is.null')
      .eq('company.is_verified', true).not('company.owner_id', 'is', null)
      .range(from, from + 999);
    const page = (data ?? []) as unknown as Row[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  const byFamily = new Map<string, Row[]>();
  const byClearance = new Map<string, Row[]>();
  for (const r of rows) {
    const f = familyOf(r.title);
    if (f) byFamily.set(f, [...(byFamily.get(f) ?? []), r]);
    const c = CLEARANCE_GROUP[r.clearance_required] ?? 'No clearance';
    byClearance.set(c, [...(byClearance.get(c) ?? []), r]);
  }
  const families = [...byFamily.entries()].map(([n, rs]) => summarize(n, rs)).filter((g): g is PayGroup => !!g).sort((a, b) => b.mid - a.mid);
  const clearance = CLEARANCE_ORDER.map((n) => summarize(n, byClearance.get(n) ?? [])).filter((g): g is PayGroup => !!g);
  return { families, clearance, total: rows.length, since };
}
