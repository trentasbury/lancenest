'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { SPOUSE_INVITE_COOKIE, acceptSpouseInvite, createSpouseInvite } from '@/lib/spouse';

export type InviteState = { url?: string; error?: string };

const ERRORS: Record<string, string> = {
  not_verified: 'Only verified service members and veterans can invite a spouse.',
  is_spouse: 'Spouse accounts can’t send spouse invites.',
  linked: 'Your spouse is already linked to your account.',
  limit: 'You’ve made 3 invite links in the last 30 days. Try again later, or have your spouse verify with documents.',
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
