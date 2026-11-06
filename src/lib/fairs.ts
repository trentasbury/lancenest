/** Career fairs: virtual, in-person pop-ups, or both. Times are entered and shown in the fair's own time zone. */

export type FairFormat = 'virtual' | 'in_person' | 'hybrid';
export const FAIR_FORMATS: { value: FairFormat; label: string }[] = [
  { value: 'virtual', label: 'Virtual' },
  { value: 'in_person', label: 'In person' },
  { value: 'hybrid', label: 'In person + virtual' },
];
export const formatLabel = (f: string | null | undefined) => FAIR_FORMATS.find((x) => x.value === f)?.label ?? 'Virtual';

export const FAIR_TIMEZONES: [string, string][] = [
  ['America/New_York', 'Eastern'], ['America/Chicago', 'Central'], ['America/Denver', 'Mountain'], ['America/Phoenix', 'Arizona'],
  ['America/Los_Angeles', 'Pacific'], ['America/Anchorage', 'Alaska'], ['Pacific/Honolulu', 'Hawaii'],
  ['America/Puerto_Rico', 'Puerto Rico'], ['Pacific/Guam', 'Guam'],
];
export const validTimezone = (tz: string) => FAIR_TIMEZONES.some(([z]) => z === tz) ? tz : 'America/New_York';

/** Turns a wall-clock time ("2026-11-20T10:00") in a time zone into the real instant. */
export function zonedTimeToUtc(local: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const offset = (ts: number) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ts));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - ts;
  };
  let ts = wall - offset(wall);
  ts = wall - offset(ts); // second pass settles daylight-saving edges
  return new Date(ts);
}

/** "Friday, November 20, 2026 at 10:00 AM EST" in the fair's time zone. */
export function fairWhen(iso: string, tz: string | null | undefined, style: 'full' | 'medium' = 'full') {
  return new Date(iso).toLocaleString('en-US', { dateStyle: style, timeStyle: 'short', timeZone: validTimezone(tz ?? ''), timeZoneName: undefined })
    + ' ' + (new Intl.DateTimeFormat('en-US', { timeZone: validTimezone(tz ?? ''), timeZoneName: 'short' }).formatToParts(new Date(iso)).find((p) => p.type === 'timeZoneName')?.value ?? '');
}

export type FairPlace = { format: string; venue_name: string | null; city: string | null; state: string | null };
export const fairPlace = (f: FairPlace) => (f.format === 'virtual' ? 'Online' : [f.venue_name, f.city && f.state ? `${f.city}, ${f.state}` : f.city ?? f.state].filter(Boolean).join(' · '));
