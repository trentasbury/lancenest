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

/** A public https address only: no IPs, ports or internal names, and nothing that resolves to a private network. */
async function publicHttpsUrl(raw: string): Promise<URL | null> {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
  const host = u.hostname.toLowerCase();
  const { isIP } = await import('node:net');
  if (isIP(host) || !host.includes('.') || /(^|\.)(localhost|local|internal|intranet|home|lan|corp)$/.test(host)) return null;
  try {
    const { lookup } = await import('node:dns/promises');
    const addrs = await lookup(host, { all: true });
    const priv = (a: string) => /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(a) || /^(::1|f[cd]|fe80|::ffff:(10|127|192\.168|169\.254)\.)/i.test(a);
    if (!addrs.length || addrs.some((a) => priv(a.address))) return null;
  } catch { return null; }
  return u;
}

/** Does the company website load (https, public, at most 3 redirects on the same site) and mention the company's name? */
export async function websiteMentions(url: string, companyName: string): Promise<boolean> {
  try {
    let next = await publicHttpsUrl(url);
    const home = next ? baseDomain(next.hostname) : '';
    for (let hop = 0; next && hop < 4; hop++) {
      const res = await fetch(next, { redirect: 'manual', signal: AbortSignal.timeout(6000), cache: 'no-store', headers: { 'User-Agent': 'LanceNest-Verification/1.0' } });
      if (res.status >= 300 && res.status < 400) {
        const to = res.headers.get('location');
        next = to ? await publicHttpsUrl(new URL(to, next).toString()) : null;
        if (next && baseDomain(next.hostname) !== home) return false;
        continue;
      }
      if (!res.ok) return false;
      return pageMentions((await res.text()).slice(0, 2_000_000), companyName);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Email domains that never prove a company: free mail, internet providers' mail, and schools and government
 * (a student or employee address there doesn't make someone that organization's recruiter). Those go to a person.
 */
const NOT_A_COMPANY_EMAIL = /^(gmail|googlemail|yahoo|ymail|rocketmail|outlook|hotmail|live|msn|passport|icloud|me|mac|aol|aim|proton|protonmail|pm|gmx|mail|email|inbox|yandex|hey|fastmail|zoho|zohomail|tutanota|tuta|tutamail|mailbox|posteo|hushmail|duck|mailfence|runbox|startmail|comcast|xfinity|att|sbcglobal|bellsouth|pacbell|ameritech|swbell|verizon|cox|charter|spectrum|rr|twc|roadrunner|earthlink|frontier|frontiernet|windstream|centurylink|centurytel|embarqmail|q|optonline|optimum|juno|netzero|peoplepc|mindspring|suddenlink|mediacom|wowway|rcn|cableone|sparklight|hughes|starlink|usa|qq|163|126|sina|naver|daum|hanmail|web|t-online|orange|free|laposte|libero|virgilio|btinternet|sky|virginmedia|talktalk|rogers|shaw|telus|sympatico|bell|videotron|bigpond|optusnet)\./i;
const INSTITUTION_EMAIL = /\.(edu|gov|mil|int)$|\.k12\.[a-z]{2}\.us$|\.(ac|edu|gov|mil)\.[a-z]{2}$/i;

/** Whether a work email's domain can count toward automatic company verification. */
export function emailCanProveCompany(emailDomain: string) {
  const d = emailDomain.toLowerCase();
  return !!d && d.includes('.') && !NOT_A_COMPANY_EMAIL.test(d) && !INSTITUTION_EMAIL.test(d);
}

export function pageMentions(html: string, companyName: string) {
  const text = html.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const words = companyName.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
    .filter((w) => w.length >= 4 && !['group', 'company', 'corporation', 'services', 'solutions', 'systems', 'holdings'].includes(w));
  return words.length > 0 && text.includes(words[0]);
}

export const MIN_DOMAIN_AGE_DAYS = 365;
