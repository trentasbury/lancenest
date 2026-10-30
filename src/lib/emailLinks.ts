import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Signed unsubscribe links: anyone holding the link can unsubscribe that one member from that one
 * list, nothing else. Signed with a server-only secret, so links can't be forged for other members.
 */
export const EMAIL_LISTS = { digest: 'weekly updates and announcements', newsletter: 'the weekly jobs newsletter' } as const;
export type EmailList = keyof typeof EMAIL_LISTS;

const key = () => `lancenest-unsubscribe:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`;

export function unsubscribeToken(profileId: string, list: EmailList): string {
  return createHmac('sha256', key()).update(`${profileId}:${list}`).digest('base64url').slice(0, 32);
}

export function verifyUnsubscribe(profileId: string, list: string, token: string): list is EmailList {
  if (!(list in EMAIL_LISTS) || !/^[0-9a-f-]{36}$/i.test(profileId) || !token) return false;
  const expected = unsubscribeToken(profileId, list as EmailList);
  return token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function unsubscribeLinks(site: string, profileId: string, list: EmailList) {
  const q = `u=${profileId}&l=${list}&t=${unsubscribeToken(profileId, list)}`;
  return { page: `${site}/unsubscribe?${q}`, oneClick: `${site}/api/email/unsubscribe?${q}` };
}
