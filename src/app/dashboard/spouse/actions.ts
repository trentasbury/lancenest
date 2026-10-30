'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { SPOUSE_INVITE_COOKIE, acceptSpouseInvite, confirmSpouse, createSpouseInvite, removeSpouse } from '@/lib/spouse';

export type InviteState = { url?: string; error?: string };

const ERRORS: Record<string, string> = {
  not_verified: 'Only verified service members and veterans can invite a spouse.',
  is_spouse: 'Spouse accounts can’t send spouse invites.',
  linked: 'Your spouse is already linked to your account.',
  limit: 'You’ve reached the invite limit (3 links a month, 2 spouses a year). Your spouse can verify with documents instead.',
  failed: 'That didn’t work. Please try again.',
};

/** A verified service member makes a one-time link for their spouse. */
export async function makeSpouseInvite(_prev: InviteState): Promise<InviteState> {
  const { user } = await requireRole(['veteran'], '/dashboard/spouse');
  const r = await createSpouseInvite(user.id);
  return 'url' in r ? { url: r.url } : { error: ERRORS[r.error] ?? ERRORS.failed };
}

/** The spouse accepts the invite kept in their cookie. */
export async function acceptInvite() {
  const { user } = await requireRole(['veteran'], '/dashboard/verification');
  const jar = await cookies();
  const result = await acceptSpouseInvite(user.id, jar.get(SPOUSE_INVITE_COOKIE)?.value);
  if (result !== 'not_spouse') jar.delete(SPOUSE_INVITE_COOKIE);
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/verification');
  redirect(result === 'ok' || result === 'already' ? '/dashboard?spouse=1' : `/dashboard/verification?invite_error=${result}`);
}

/** The service member confirms their spouse is still their spouse (once a year). */
export async function confirmMySpouse() {
  const { user } = await requireRole(['veteran'], '/dashboard/spouse');
  const ok = await confirmSpouse(user.id);
  revalidatePath('/dashboard/spouse');
  redirect(ok ? '/dashboard/spouse?confirmed=1' : '/dashboard/spouse');
}

/** The service member removes the link (divorce or separation). The spouse gets a grace period to verify on their own. */
export async function removeMySpouse(formData: FormData) {
  const { user } = await requireRole(['veteran'], '/dashboard/spouse');
  if (formData.get('sure') !== 'on') redirect('/dashboard/spouse?error=sure');
  const ok = await removeSpouse(user.id);
  revalidatePath('/dashboard/spouse');
  redirect(ok ? '/dashboard/spouse?removed=1' : '/dashboard/spouse');
}
