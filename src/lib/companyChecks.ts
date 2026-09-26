import 'server-only';

/** Registrable domain for US-style names: "us.harborline.com" -> "harborline.com". */
export function baseDomain(host: string) {
  const parts = host.toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
  return parts.length > 2 ? parts.slice(-2).join('.') : parts.join('.');
}

/** Days since the domain was registered, from the public RDAP registry (free, no key). Null if unknown. */
export async function domainAgeDays(domain: string): Promise<number | null> {
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { Accept: 'application/rdap+json' }, signal: AbortSignal.timeout(6000), cache: 'no-store',
    });
    if (!res.ok) return null;
    return registrationAgeFromRdap(await res.json());
  } catch {
    return null;
  }
}

export function registrationAgeFromRdap(data: unknown): number | null {
  const events = (data as { events?: { eventAction?: string; eventDate?: string }[] })?.events ?? [];
  const reg = events.find((e) => e.eventAction === 'registration')?.eventDate;
  const t = reg ? Date.parse(reg) : NaN;
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86400000);
}

/** Does the company website load and mention the company's name? */
export async function websiteMentions(url: string, companyName: string): Promise<boolean> {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(6000), cache: 'no-store', headers: { 'User-Agent': 'LanceNest-Verification/1.0' } });
    if (!res.ok) return false;
    return pageMentions(await res.text(), companyName);
  } catch {
    return false;
  }
}

export function pageMentions(html: string, companyName: string) {
  const text = html.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const words = companyName.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
    .filter((w) => w.length >= 4 && !['group', 'company', 'corporation', 'services', 'solutions', 'systems', 'holdings'].includes(w));
  return words.length > 0 && text.includes(words[0]);
}

export const MIN_DOMAIN_AGE_DAYS = 365;
