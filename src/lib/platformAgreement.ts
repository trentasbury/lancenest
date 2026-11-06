import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Terms acceptance at sign-up, the way Upwork does it (November 2, 2026): one required box agreeing to the Terms,
 * which include the rule to book work found on LanceNest through LanceNest (24 months, like Upwork's). Each
 * acceptance is kept with the wording version and time, as evidence if someone takes a client off the platform.
 * Messages also show reminders about keeping talk and bookings on LanceNest (components/messages/TosReminder).
 */
export const TERMS_VERSION = 'terms-2026-11-06'; // adds the no-refunds and suspension-and-removal terms
export const TERMS_FIELD = 'terms';
export const TERMS_REQUIRED = 'Please tick the box to agree to the Terms of Service.';

export async function recordTermsAcceptance(profileId: string, role: string | null | undefined) {
  const side = role === 'employer' || role === 'client' ? 'client' : 'freelancer';
  const { error } = await createAdminClient().from('platform_agreements')
    .upsert({ profile_id: profileId, side, version: TERMS_VERSION }, { onConflict: 'profile_id,side,version', ignoreDuplicates: true });
  if (error) console.error('recordTermsAcceptance failed:', error.message);
}
