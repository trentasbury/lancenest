import { US_STATES } from './states';

/**
 * "Where can I work?" — shared by job search and job alerts.
 * A state means: remote jobs from anywhere (you can do them from that state), plus hybrid and on-site jobs
 * located in that state. Picking arrangements narrows it (e.g. Remote + On-site, or On-site only).
 */
export const ARRANGEMENTS = [['remote', 'Remote'], ['hybrid', 'Hybrid'], ['onsite', 'On-site']] as const;
export type Arrangement = (typeof ARRANGEMENTS)[number][0];
const VALID = ARRANGEMENTS.map(([v]) => v) as string[];

/** Reads ?arrangement=remote, ?arrangement=remote,onsite or repeated ?arrangement= values. Empty = any. */
export function parseArrangements(value: string | string[] | null | undefined): Arrangement[] {
  const raw = (Array.isArray(value) ? value : [value ?? '']).flatMap((v) => String(v).split(','));
  return Array.from(new Set(raw.map((v) => v.trim().toLowerCase()).filter((v) => VALID.includes(v)))) as Arrangement[];
}

export function stateOf(code: string | null | undefined): [string, string] | null {
  if (!code) return null;
  return US_STATES.find(([c, name]) => c === code.toUpperCase() || name.toLowerCase() === code.toLowerCase()) ?? null;
}

/** Does a job's location text ("Arlington, VA", "Norfolk, Virginia; San Diego, CA") fall in the state? */
export function locatedIn(location: string | null | undefined, code: string): boolean {
  const st = stateOf(code);
  if (!st || !location) return false;
  const [abbr, name] = st;
  if (new RegExp(`(^|[,;/(]\\s*)${abbr}\\b`, 'i').test(location)) return true;
  // "Virginia" also appears in "West Virginia".
  const text = abbr === 'VA' ? location.replace(/west virginia/gi, '') : location;
  return new RegExp(`\\b${name}\\b`, 'i').test(text);
}

/** Job alerts (in code): the same rule as the search below. */
export function jobMatchesPlace(job: { location: string | null; work_arrangement: string | null }, state: string | null, arrangements: Arrangement[]) {
  const arr = (job.work_arrangement ?? 'onsite') as Arrangement;
  if (arrangements.length && !arrangements.includes(arr)) return false;
  if (!state || state === 'multi') return true;
  return arr === 'remote' || locatedIn(job.location, state);
}

/**
 * Job search (database): a PostgREST filter expression for state + arrangements, or null for "anywhere".
 * Values are double-quoted because "City, ST" contains a comma, which otherwise splits the filter.
 */
export function placeFilter(state: string | null | undefined, arrangements: Arrangement[]): string | null {
  const st = stateOf(state ?? '');
  if (!st) return arrangements.length ? `work_arrangement.in.(${arrangements.join(',')})` : null;
  const [abbr, name] = st;
  const local = (arrangements.length ? arrangements : (['hybrid', 'onsite'] as Arrangement[])).filter((a) => a !== 'remote');
  const includeRemote = !arrangements.length || arrangements.includes('remote');
  const inState = `or(location.ilike."%, ${abbr}%",location.ilike."%${name}%")`;
  const parts: string[] = [];
  if (local.length) parts.push(`and(work_arrangement.in.(${local.join(',')}),${inState})`);
  if (includeRemote) parts.push('work_arrangement.eq.remote');
  return parts.length === 1 ? parts[0] : `or(${parts.join(',')})`;
}
