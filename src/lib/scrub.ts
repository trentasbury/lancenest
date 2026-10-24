// Hides who is hiring in public job text (no server-only imports, so it can be tested on its own).

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Names a reader could use to identify the employer: the full name, the name without "Inc."-style endings, the web address. */
export function employerNames(name: string | null, website: string | null) {
  const out = new Set<string>();
  const n = (name ?? '').trim();
  if (n.length >= 3) {
    out.add(n);
    const bare = n.replace(/[,.]?\s+(inc|llc|l\.l\.c|corp|corporation|co|company|group|ltd|limited|holdings|partners|lp|llp|plc)\.?$/i, '').trim();
    if (bare.length >= 3) out.add(bare);
  }
  try {
    const host = new URL(website ?? '').hostname.replace(/^www\./, '');
    if (host) { out.add(host); const label = host.split('.')[0]; if (label.length >= 4) out.add(label); }
  } catch { /* no website */ }
  return [...out].sort((a, b) => b.length - a.length);
}

/** Removes any way to reach the employer outside LanceNest (emails, links, phone numbers), then their name. */
export function scrubText(text: string, names: string[]) {
  let t = text;
  t = t.replace(/[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/gi, '[email removed]');
  t = t.replace(/\b(?:https?:\/\/|www\.)\S+/gi, (m) => `[link removed]${m.match(/[.,;:!?)]+$/)?.[0] ?? ''}`);
  t = t.replace(/\b[a-z0-9-]+\.(com|net|org|io|co|us|gov|mil|biz|info|careers|jobs)\b(\/\S*)?/gi, (m) => (/^lancenest\.com|^(asp|vb|ado)\.net$/i.test(m) ? m : '[link removed]'));
  t = t.replace(/(\+?1[\s.-]?)?\(?\b[2-9][0-9]{2}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}\b/g, '[phone removed]');
  for (const n of names) t = t.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(n)}('s|’s)?(?=$|[^\\p{L}\\p{N}])`, 'giu'), (_m, pre: string, poss?: string) => `${pre}${poss ? 'the company’s' : 'the company'}`);
  // "the company" at the start of a sentence.
  t = t.replace(/(^|[.!?]\s+|\n\s*)the company/g, (_m, pre: string) => `${pre}The company`);
  return t;
}
