import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe';

const BUCKETS = ['verification-docs', 'post-media', 'avatars', 'resumes', 'company-logos'];

export type DeletionBlock = 'suspended' | 'contracts_open' | 'contracts_history';

/**
 * Why an account can't be deleted right now (null when it can). Freelance contracts are kept for the other person's
 * protection (payments, reviews, disputes), and a suspended member can't delete and re-register to wipe a suspension.
 */
export async function deletionBlocker(userId: string, bySelf: boolean): Promise<DeletionBlock | null> {
  const admin = createAdminClient();
  if (bySelf) {
    const { data: p } = await admin.from('profiles').select('banned, suspended_until').eq('id', userId).maybeSingle();
    if (p?.banned || (p?.suspended_until && Date.parse(p.suspended_until as string) > Date.now())) return 'suspended';
  }
  const { data: k } = await admin.from('contracts').select('status').or(`client_id.eq.${userId},freelancer_id.eq.${userId}`).limit(500);
  if ((k ?? []).some((x) => x.status === 'active' || x.status === 'disputed')) return 'contracts_open';
  if ((k ?? []).length) return 'contracts_history';
  return null;
}

/**
 * Permanently deletes a member: cancels any paid subscriptions, deletes their uploaded files,
 * removes companies they own, then deletes the account (every related row cascades).
 * Call only after an authorization check.
 */
export async function deleteMemberCompletely(userId: string) {
  const admin = createAdminClient();
  // Check before touching anything, so a blocked deletion never leaves a half-deleted account (billing stopped, files gone).
  const blocked = await deletionBlocker(userId, false);
  if (blocked) throw new Error(blocked);

  const { data: companies } = await admin.from('companies').select('id').eq('owner_id', userId);
  const companyIds = (companies ?? []).map((c) => c.id as string);

  // 1. Stop billing first.
  const filter = [`profile_id.eq.${userId}`, ...(companyIds.length ? [`company_id.in.(${companyIds.join(',')})`] : [])].join(',');
  const { data: subs } = await admin.from('subscriptions').select('stripe_subscription_id, status').or(filter);
  for (const s of subs ?? []) {
    if (!s.stripe_subscription_id || ['canceled', 'incomplete_expired'].includes(s.status as string)) continue;
    try {
      await stripe().subscriptions.cancel(s.stripe_subscription_id as string);
    } catch (err) {
      console.error('subscription cancel failed during account deletion:', err);
    }
  }

  // 2. Delete every file they uploaded (documents, photos, resumes, logos).
  for (const bucket of BUCKETS) {
    const { data: files } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
    const paths = (files ?? []).map((f) => `${userId}/${f.name}`);
    if (paths.length) await admin.storage.from(bucket).remove(paths);
  }

  // 3. Companies they own (their jobs and applications go with them).
  if (companyIds.length) await admin.from('companies').delete().in('id', companyIds);

  // 4. The account itself — profile, posts, messages, and everything else cascade.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}
