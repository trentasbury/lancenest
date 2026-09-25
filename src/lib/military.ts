export const BRANCHES = ['Army', 'Navy', 'Air Force', 'Marine Corps', 'Coast Guard', 'Space Force'] as const;
export const COMPONENTS = [
  ['active', 'Active duty'],
  ['reserve', 'Reserve'],
  ['guard', 'National Guard'],
] as const;
export const CLEARANCES = [
  ['none', 'None'],
  ['public_trust', 'Public Trust'],
  ['confidential', 'Confidential'],
  ['secret', 'Secret'],
  ['top_secret', 'Top Secret'],
  ['ts_sci', 'TS/SCI'],
] as const;

/** Year input -> date column value (Jan 1 of that year), or null. */
export function yearToDate(value: FormDataEntryValue | null): string | null {
  const y = Number(String(value ?? '').trim());
  return Number.isInteger(y) && y >= 1950 && y <= 2100 ? `${y}-01-01` : null;
}

export function yearOf(date: string | null): string {
  return date ? date.slice(0, 4) : '';
}
