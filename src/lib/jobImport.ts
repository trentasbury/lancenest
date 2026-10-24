import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { SupabaseClient } from '@supabase/supabase-js';
import { slugify } from '@/lib/format';
import { scamSignals } from '@/lib/scam';

/**
 * Imports an employer's open jobs from their hiring system, so they don't retype them:
 * Greenhouse, Lever and Ashby (their public job-board feeds) or any XML job feed in the common (Indeed-style) format.
 * Jobs without posted pay come in as drafts (pay is required to publish on LanceNest). Re-importing updates jobs it
 * already brought in, and closes ones the feed no longer lists.
 */
export type FeedKind = 'greenhouse' | 'lever' | 'ashby' | 'xml';
export const FEED_LABELS: Record<FeedKind, string> = { greenhouse: 'Greenhouse', lever: 'Lever', ashby: 'Ashby', xml: 'XML job feed' };
const MAX_JOBS = 100;
const MAX_BYTES = 5 * 1024 * 1024;

type Normalized = {
  externalId: string; title: string; location: string | null; arrangement: 'remote' | 'hybrid' | 'onsite';
  employmentType: 'full_time' | 'part_time' | 'contract' | 'internship'; description: string; applyUrl: string | null;
  salaryMin: number | null; salaryMax: number | null; salaryPeriod: 'year' | 'hour';
};

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', mdash: '—', ndash: '–', hellip: '…', bull: '•' };
function decode(s: string) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}
/** HTML (possibly entity-encoded, as Greenhouse sends it) to plain text with line breaks for lists and paragraphs. */
export function htmlToText(html: string) {
  let s = html.includes('&lt;') ? decode(html) : html;
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<li[^>]*>/gi, '\n• ').replace(/<\/(p|div|h[1-6]|ul|ol|tr)>/gi, '\n').replace(/<\/li>/gi, '').replace(/<br\s*\/?>/gi, '\n');
  s = decode(s.replace(/<[^>]+>/g, ''));
  return s.split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim()).filter((l, i, a) => l || (a[i - 1] ?? '') !== '').join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function employment(raw: string | null | undefined): Normalized['employmentType'] {
  const t = (raw ?? '').toLowerCase();
  if (/intern/.test(t)) return 'internship';
  if (/part/.test(t)) return 'part_time';
  if (/contract|temporary|temp\b|freelance|consult/.test(t)) return 'contract';
  return 'full_time';
}
function arrangement(remote: boolean, raw?: string | null): Normalized['arrangement'] {
  const t = (raw ?? '').toLowerCase();
  if (/hybrid/.test(t)) return 'hybrid';
  if (remote || /remote|telecommute|work from home/.test(t)) return 'remote';
  return 'onsite';
}
const clip = (s: string | null | undefined, n: number) => (s ?? '').trim().slice(0, n) || null;

/** Only public web addresses: no IPs, no internal names, nothing that resolves to a private network. */
async function safePublicUrl(raw: string): Promise<URL | null> {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
  const host = u.hostname.toLowerCase();
  if (isIP(host) || !host.includes('.') || /(^|\.)(localhost|local|internal|intranet|home|lan|corp)$/.test(host)) return null;
  try {
    const addrs = await lookup(host, { all: true });
    const priv = (a: string) => /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(a) || /^(::1|f[cd]|fe80|::ffff:(10|127|192\.168|169\.254)\.)/i.test(a);
    if (!addrs.length || addrs.some((a) => priv(a.address))) return null;
  } catch { return null; }
  return u;
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'LanceNest job import (+https://www.lancenest.com)', Accept: 'application/json, application/xml, text/xml' } });
  if (!res.ok) throw new Error(`feed_${res.status}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_BYTES) throw new Error('feed_too_big');
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error('feed_too_big');
  return text;
}

export function validSource(kind: FeedKind, source: string) {
  if (kind === 'greenhouse') return /^[a-z0-9_-]{2,60}$/i.test(source);
  if (kind === 'lever') return /^[a-z0-9-]{2,60}$/i.test(source);
  if (kind === 'ashby') return /^[A-Za-z0-9._-]{2,80}$/.test(source);
  return /^https:\/\/\S{6,500}$/.test(source);
}

/** Reads the feed and returns its jobs in LanceNest's shape (at most 100). */
export async function readFeed(kind: FeedKind, source: string): Promise<Normalized[]> {
  if (!validSource(kind, source)) throw new Error('bad_source');
  const out: Normalized[] = [];
  if (kind === 'greenhouse') {
    const j = JSON.parse(await getText(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(source)}/jobs?content=true&pay_transparency=true`)) as { jobs?: { id: number; title: string; location?: { name?: string }; content?: string; absolute_url?: string; pay_input_ranges?: { min_cents?: number; max_cents?: number; currency_type?: string }[] }[] };
    for (const x of j.jobs ?? []) {
      const pay = (x.pay_input_ranges ?? []).find((p) => (p.currency_type ?? 'USD') === 'USD');
      const loc = x.location?.name ?? null;
      out.push({ externalId: String(x.id), title: x.title, location: clip(loc, 120), arrangement: arrangement(false, loc), employmentType: 'full_time', description: htmlToText(x.content ?? ''), applyUrl: x.absolute_url ?? null,
        salaryMin: pay?.min_cents ? Math.round(pay.min_cents / 100) : null, salaryMax: pay?.max_cents ? Math.round(pay.max_cents / 100) : null, salaryPeriod: 'year' });
    }
  } else if (kind === 'lever') {
    const j = JSON.parse(await getText(`https://api.lever.co/v0/postings/${encodeURIComponent(source)}?mode=json`)) as { id: string; text: string; categories?: { location?: string; commitment?: string }; workplaceType?: string; descriptionPlain?: string; lists?: { text: string; content: string }[]; additionalPlain?: string; hostedUrl?: string; salaryRange?: { min?: number; max?: number; currency?: string; interval?: string } }[];
    for (const x of Array.isArray(j) ? j : []) {
      const lists = (x.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join('\n\n');
      const usd = x.salaryRange && (x.salaryRange.currency ?? 'USD') === 'USD' ? x.salaryRange : null;
      const hourly = /hour/i.test(usd?.interval ?? '');
      out.push({ externalId: x.id, title: x.text, location: clip(x.categories?.location, 120), arrangement: arrangement(x.workplaceType === 'remote', x.workplaceType === 'hybrid' ? 'hybrid' : x.categories?.location), employmentType: employment(x.categories?.commitment),
        description: [x.descriptionPlain, lists, x.additionalPlain].filter(Boolean).join('\n\n').trim(), applyUrl: x.hostedUrl ?? null,
        salaryMin: usd?.min ?? null, salaryMax: usd?.max ?? null, salaryPeriod: hourly ? 'hour' : 'year' });
    }
  } else if (kind === 'ashby') {
    const j = JSON.parse(await getText(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(source)}?includeCompensation=true`)) as { jobs?: { id: string; title: string; location?: string; employmentType?: string; isRemote?: boolean; workplaceType?: string; descriptionPlain?: string; jobUrl?: string; isListed?: boolean; compensation?: { summaryComponents?: { compensationType?: string; interval?: string; minValue?: number; maxValue?: number; currencyCode?: string }[] } }[] };
    for (const x of j.jobs ?? []) {
      if (x.isListed === false) continue;
      const pay = (x.compensation?.summaryComponents ?? []).find((c) => c.compensationType === 'Salary' && (c.currencyCode ?? 'USD') === 'USD');
      out.push({ externalId: x.id, title: x.title, location: clip(x.location, 120), arrangement: arrangement(!!x.isRemote, x.workplaceType), employmentType: employment(x.employmentType), description: (x.descriptionPlain ?? '').trim(), applyUrl: x.jobUrl ?? null,
        salaryMin: pay?.minValue ?? null, salaryMax: pay?.maxValue ?? null, salaryPeriod: /hour/i.test(pay?.interval ?? '') ? 'hour' : 'year' });
    }
  } else {
    const url = await safePublicUrl(source);
    if (!url) throw new Error('bad_source');
    const xml = await getText(url.toString());
    const tag = (block: string, name: string) => {
      const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
      return m ? decode(m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')).trim() : null;
    };
    for (const m of xml.matchAll(/<job\b[^>]*>([\s\S]*?)<\/job>/gi)) {
      const b = m[1];
      const id = tag(b, 'referencenumber') ?? tag(b, 'id') ?? tag(b, 'url');
      const title = tag(b, 'title');
      if (!id || !title) continue;
      const loc = [tag(b, 'city'), tag(b, 'state')].filter(Boolean).join(', ') || tag(b, 'location');
      const salary = tag(b, 'salary') ?? '';
      const nums = [...salary.replace(/,/g, '').matchAll(/\$?\s*(\d+(?:\.\d+)?)\s*(k)?/gi)].map((n) => Number(n[1]) * (n[2] ? 1000 : 1)).filter((n) => n >= 7);
      const hourly = /hour|hr/i.test(salary);
      out.push({ externalId: id.slice(0, 200), title, location: clip(loc, 120), arrangement: arrangement(/remote/i.test(tag(b, 'remotetype') ?? ''), loc), employmentType: employment(tag(b, 'jobtype')),
        description: htmlToText(tag(b, 'description') ?? ''), applyUrl: tag(b, 'url'), salaryMin: nums[0] ?? null, salaryMax: nums[1] ?? nums[0] ?? null, salaryPeriod: hourly ? 'hour' : 'year' });
      if (out.length >= MAX_JOBS) break;
    }
  }
  return out.filter((x) => x.title && x.description).slice(0, MAX_JOBS).map((x) => ({ ...x, title: x.title.trim().slice(0, 140), description: x.description.slice(0, 8000) }));
}

export type ImportResult = { found: number; published: number; drafts: number; updated: number; closed: number; skipped: number; limitHit: boolean };

/**
 * Saves the feed's jobs for a company. `db` is the employer's own client (job limits and link rules apply as usual),
 * or the server client for the daily sync.
 */
export async function importJobs(db: SupabaseClient, companyId: string, kind: FeedKind, jobs: Normalized[]): Promise<ImportResult> {
  const r: ImportResult = { found: jobs.length, published: 0, drafts: 0, updated: 0, closed: 0, skipped: 0, limitHit: false };
  const { data: existing } = await db.from('jobs').select('id, external_id, status').eq('company_id', companyId).eq('external_source', kind).limit(1000);
  const byExt = new Map(((existing ?? []) as { id: string; external_id: string; status: string }[]).map((e) => [e.external_id, e]));
  const seen = new Set<string>();
  for (const j of jobs) {
    seen.add(j.externalId);
    const hasPay = j.salaryMin != null || j.salaryMax != null;
    const ok = hasPay && !scamSignals(`${j.title}\n${j.description}`, 'block').length;
    const fields = {
      title: j.title, location: j.location, work_arrangement: j.arrangement, employment_type: j.employmentType, description: j.description,
      salary_min: j.salaryMin ?? j.salaryMax, salary_max: j.salaryMax ?? j.salaryMin, salary_period: j.salaryPeriod,
      apply_mode: j.applyUrl ? 'both' : 'easy', apply_url: j.applyUrl,
    };
    const prior = byExt.get(j.externalId);
    const save = async (f: Record<string, unknown>) => prior
      ? db.from('jobs').update(f).eq('id', prior.id).eq('company_id', companyId)
      : db.from('jobs').insert({ ...f, company_id: companyId, external_source: kind, external_id: j.externalId, status: ok ? 'open' : 'draft', slug: `${slugify(`${j.title} ${j.location ?? ''}`)}-${Math.random().toString(36).slice(2, 7)}` });
    let { error } = await save(fields);
    // The company's own careers site isn't a link LanceNest can verify yet: take applications on LanceNest instead.
    if (error?.code === 'P0008') ({ error } = await save({ ...fields, apply_mode: 'easy', apply_url: null }));
    if (error?.code === 'P0003') { r.limitHit = true; break; }
    if (error) { r.skipped++; continue; }
    if (prior) r.updated++;
    else if (ok) r.published++;
    else r.drafts++;
  }
  // Jobs this feed brought in earlier that it no longer lists are closed.
  for (const e of byExt.values()) {
    if (!seen.has(e.external_id) && e.status === 'open' && !r.limitHit) {
      const { error } = await db.from('jobs').update({ status: 'closed' }).eq('id', e.id);
      if (!error) r.closed++;
    }
  }
  return r;
}
