'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { redeemPartnerCode } from '@/lib/partnerCodes';

const PARTNER_COOKIE = 'ln_partner';

/** Redeems a partner code typed in, or carried over from a partner's sign-up link. */
export async function redeemCode(backRaw: '/plans' | '/dashboard', formData: FormData) {
  // The bound page comes back from the browser, so only these two are accepted.
  const back = backRaw === '/dashboard' ? '/dashboard' : '/plans';
  const { user } = await requireRole(['veteran'], back);
  const result = await redeemPartnerCode(user.id, String(formData.get('code') ?? ''));
  if (result === 'ok' || result === 'already' || result === 'invalid' || result === 'used_up') (await cookies()).delete(PARTNER_COOKIE);
  redirect(`${back}?code=${result}`);
}
