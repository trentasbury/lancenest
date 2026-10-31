import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { CATEGORIES } from '@/lib/freelance';
import { scamSignals } from '@/lib/scam';
import { CONTACT_BLOCKED, EXPLICIT_BLOCKED } from '@/lib/contact';

/**
 * Guest project posting: a civilian fills out a project and creates a free client account in one step. The project
 * waits as a draft until they confirm their email, then publishes under their account with every normal rule.
 */
const DAY = 86400000;
export const GUEST_DRAFTS_PER_IP_PER_DAY = 3;
export const DRAFT_DAYS = 14;

export type DraftPayload = {
  title: string; description: string; category: string | null; work_location: string;
  budget_type: 'fixed' | 'hourly'; budget_min: number | null; budget_max: number | null;
};

const secret = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'lancenest-dev';

/** A signed timestamp put in the form when it's shown, so we know how long a person took to fill it in. */
export function formStartToken(now = Date.now()) {
  const sig = createHmac('sha256', secret()).update(`guest-post:${now}`).digest('hex').slice(0, 32);
  return `${now}.${sig}`;
}

/** Bots fill forms in a second or two; people take longer. Tokens older than 3 hours are refused. */
export function checkFormStart(token: string): { valid: boolean; tooFast: boolean } {
  const [ts, sig] = token.split('.');
  const when = Number(ts);
  if (!Number.isFinite(when) || !sig) return { valid: false, tooFast: false };
  const expected = createHmac('sha256', secret()).update(`guest-post:${when}`).digest('hex').slice(0, 32);
  const ok = expected.length === sig.length && timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  const age = Date.now() - when;
  if (!ok || age > 3 * 3600000 || age < 0) return { valid: false, tooFast: false };
  return { valid: true, tooFast: age < 6000 };
}

/** An anonymous, per-day code for the visitor's connection (the raw address is never stored). */
export function ipHash(ip: string) {
  return createHash('sha256').update(`${new Date().toISOString().slice(0, 10)}|${ip}|${secret()}`).digest('hex').slice(0, 32);
}

/** Throwaway inboxes used by spammers and bots. Real clients use an address they keep. */
const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com', 'grr.la', '10minutemail.com', '10minutemail.net', 'tempmail.com',
  'temp-mail.org', 'tempmail.net', 'tempmailo.com', 'tempail.com', 'yopmail.com', 'yopmail.net', 'trashmail.com', 'trashmail.de', 'getnada.com',
  'nada.email', 'dispostable.com', 'maildrop.cc', 'mailnesia.com', 'mintemail.com', 'throwawaymail.com', 'fakeinbox.com', 'emailondeck.com',
  'mohmal.com', 'mailcatch.com', 'spamgourmet.com', 'moakt.com', 'burnermail.io', 'inboxkitten.com', 'mytemp.email', 'tmpmail.org', 'tmpmail.net',
  'mail.tm', 'mail.gw', 'emailfake.com', 'fakemail.net', 'luxusmail.org', 'discard.email', 'spambox.us', 'getairmail.com', 'anonaddy.me', '33mail.com',
]);
export function isDisposableEmail(email: string) {
  const domain = email.split('@')[1]?.toLowerCase().trim() ?? '';
  return !domain || DISPOSABLE.has(domain) || [...DISPOSABLE].some((d) => domain.endsWith(`.${d}`));
}

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|us|me|biz|info|app|dev|ly|link|page|site|xyz|ru|cn|top)\b)/i;
const money = (v: string) => { const n = Math.round(Number(v.replace(/[$,\s]/g, ''))); return Number.isFinite(n) && n > 0 && n <= 10_000_000 ? n : null; };
const t = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? '').trim().slice(0, max);

const SCREEN_MESSAGE: Record<string, string> = { explicit: EXPLICIT_BLOCKED, pii: 'That looks like a Social Security number. For everyone’s safety, LanceNest never allows them. Please remove it.' };

/** Checks a guest's project the way a published one is checked, plus stricter rules for accounts with no history. */
export async function validateGuestProject(fd: FormData): Promise<{ error?: string; payload?: DraftPayload }> {
  const title = t(fd, 'title', 140), description = t(fd, 'description', 8000);
  if (title.length < 4 || description.length < 40) return { error: 'Add a title and describe the work in at least a couple of sentences (40 characters or more).' };
  const risky = ['set_hours', 'supervise', 'indefinite', 'exclusive'].some((k) => fd.get(k) === 'on');
  if (risky && fd.get('classification_ack') !== 'on') return { error: 'You checked a box that suggests employee-style control. Confirm the acknowledgment, or post this as a job instead.' };
  const text = `${title}\n${description}`;
  // New accounts get the strict list: anything that looks like a fee, a payment app, an ID request or bank details.
  const scam = scamSignals(text, 'all');
  if (scam.length) return { error: `This project ${scam[0]}, which is common in scams. Please remove it. Payment is arranged on LanceNest after you hire.` };
  if (LINK.test(text)) return { error: 'Leave links out of the project. Once you hire, you can share details in messages.' };
  const { data: flag } = await createAdminClient().rpc('screen_text', { t: text });
  if (flag) return { error: SCREEN_MESSAGE[flag as string] ?? CONTACT_BLOCKED };
  const min = money(t(fd, 'budget_min', 9)), max = money(t(fd, 'budget_max', 9));
  if (min && max && max < min) return { error: 'The maximum budget can’t be lower than the minimum.' };
  const category = t(fd, 'category', 60);
  const location = t(fd, 'work_location', 120);
  if (location && (await createAdminClient().rpc('screen_text', { t: location })).data) return { error: CONTACT_BLOCKED };
  return { payload: {
    title, description, category: CATEGORIES.includes(category) ? category : null, work_location: location || 'Remote',
    budget_type: t(fd, 'budget_type', 6) === 'hourly' ? 'hourly' : 'fixed', budget_min: min, budget_max: max,
  } };
}

const PUBLISH_ERROR: Record<string, string> = { P0009: 'pii', P0017: 'contact', P0022: 'explicit', P0023: 'limit' };

/**
 * Publishes the newest waiting draft for a signed-in client, once. Returns the new project's id, or an error code the
 * posting page understands. Admins are told about every project posted this way.
 */
export async function publishPendingDraft(userId: string): Promise<{ id?: string; error?: string }> {
  const admin = createAdminClient();
  const { data: d } = await admin.from('project_drafts').select('id, payload, created_at')
    .eq('profile_id', userId).is('published_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!d) return {};
  if (Date.now() - Date.parse(d.created_at as string) > DRAFT_DAYS * DAY) return { error: 'expired' };
  // Claim it first, so a double click or a reload can't post it twice.
  const { data: claimed } = await admin.from('project_drafts').update({ published_at: new Date().toISOString() })
    .eq('id', d.id).is('published_at', null).select('id').maybeSingle();
  if (!claimed) return {};
  const p = d.payload as DraftPayload;
  const supabase = await createClient();
  const { data, error } = await supabase.from('freelance_projects').insert({
    client_id: userId, company_id: null, title: p.title, description: p.description, category: p.category,
    work_location: p.work_location, budget_type: p.budget_type, budget_min: p.budget_min, budget_max: p.budget_max, clearance_required: 'none',
  }).select('id, title').single();
  if (error || !data) {
    await admin.from('project_drafts').update({ published_at: null }).eq('id', d.id);
    console.error('publishPendingDraft:', error?.message);
    return { error: PUBLISH_ERROR[error?.code ?? ''] ?? 'save' };
  }
  await admin.from('project_drafts').update({ published_project_id: data.id }).eq('id', d.id);
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  if (admins?.length) await admin.from('notifications').insert(admins.map((a) => ({
    profile_id: a.id, type: 'report_alert', title: `New client posted a project from the public form: “${(data.title as string).slice(0, 80)}”. Give it a quick look.`, link: `/freelance/projects/${data.id}`,
  })));
  return { id: data.id as string };
}
