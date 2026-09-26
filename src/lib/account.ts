import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe';

const BUCKETS = ['verification-docs', 'post-media', 'avatars', 'resumes', 'company-logos'];

/**
 * Permanently deletes a member: cancels any paid subscriptions, deletes their uploaded files,
 * removes companies they own, then deletes the account (every related row cascades).
 * Call only after an authorization check.
 */
export async function deleteMemberCompletely(userId: string) {
  const admin = createAdminClient();

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
