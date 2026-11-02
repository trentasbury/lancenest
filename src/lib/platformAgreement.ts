import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * "Book it on LanceNest" (approved November 2, 2026), like Upwork's agreement: freelancers agree once before their
 * first proposal or live listing, clients and employers once before their first booking. Kept with the wording version
 * and time. While LanceNest payments are off, clients pay freelancers directly after the booking fee, so the promise
 * is about booking the work here (not where the money moves); 24 months matches the Terms.
 */
export type AgreementSide = 'freelancer' | 'client';

export const PLATFORM_AGREEMENT: Record<AgreementSide, { version: string; text: string }> = {
  freelancer: {
    version: 'freelancer-2026-11-02',
    text: 'I’ll book every job I find on LanceNest through LanceNest. For 24 months, I won’t take a client I met here off the platform to avoid fees. I understand that doing so can get my account removed.',
  },
  client: {
    version: 'client-2026-11-02',
    text: 'For 24 months, I’ll book and pay for work I find on LanceNest through LanceNest, including future work with freelancers I meet here.',
  },
};

export const AGREEMENT_FIELD = 'book_on_platform';
export const AGREEMENT_REQUIRED = 'Tick the box to agree to book work you find on LanceNest through LanceNest. You only do this once.';

export async function hasAgreed(profileId: string, side: AgreementSide) {
  const { data } = await createAdminClient().from('platform_agreements').select('agreed_at')
    .eq('profile_id', profileId).eq('side', side).limit(1);
  return (data ?? []).length > 0;
}

export async function recordAgreement(profileId: string, side: AgreementSide) {
  const { error } = await createAdminClient().from('platform_agreements')
    .upsert({ profile_id: profileId, side, version: PLATFORM_AGREEMENT[side].version }, { onConflict: 'profile_id,side,version', ignoreDuplicates: true });
  if (error) console.error('recordAgreement failed:', error.message);
  return !error;
}

/** Already agreed, or agreeing now with the box on this form. False means the box wasn't ticked. */
export async function ensureAgreement(profileId: string, side: AgreementSide, formData?: FormData) {
  if (await hasAgreed(profileId, side)) return true;
  if (formData?.get(AGREEMENT_FIELD) === 'on') return recordAgreement(profileId, side);
  return false;
}
