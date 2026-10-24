import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { LICENSED_TRADES } from '@/lib/flags';

export type Credential = { id: string; kind: 'license' | 'certificate'; name: string; trade: string | null; issuer: string | null; state: string | null; expires_on: string | null; status: string; note: string | null; created_at: string };

/** A member's own credentials (they see the review status; license numbers stay server-side). */
export async function myCredentials(profileId: string): Promise<Credential[]> {
  const { data } = await createAdminClient().from('credentials').select('id, kind, name, trade, issuer, state, expires_on, status, note, created_at').eq('profile_id', profileId).order('created_at', { ascending: false });
  return (data ?? []) as Credential[];
}

/** What a profile shows: verified, unexpired credentials only. */
export async function verifiedCredentials(profileId: string): Promise<Credential[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await createAdminClient().from('credentials').select('id, kind, name, trade, issuer, state, expires_on, status, note, created_at')
    .eq('profile_id', profileId).eq('status', 'verified').or(`expires_on.is.null,expires_on.gte.${today}`).order('kind');
  return (data ?? []) as Credential[];
}

/** Licensed trades this member may offer (verified, unexpired license). */
export async function licensedTrades(profileId: string): Promise<string[]> {
  const creds = await verifiedCredentials(profileId);
  return LICENSED_TRADES.filter((t) => creds.some((c) => c.kind === 'license' && c.trade === t));
}
