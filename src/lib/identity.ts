import 'server-only';
import { createHash, createHmac } from 'crypto';

/**
 * One-way fingerprint of a person's legal name + date of birth (as typed from their DD-214).
 * Keyed with a server secret so it can't be reversed or guessed from outside. Middle names are
 * ignored because they're written inconsistently.
 */
export function identityHash(first: string, last: string, dob: string) {
  const key = createHash('sha256').update(`lancenest-identity-v1:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`).digest();
  const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z]/g, '');
  return createHmac('sha256', key).update(`${norm(last)}|${norm(first)}|${dob}`).digest('hex');
}
