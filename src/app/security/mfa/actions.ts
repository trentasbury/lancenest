'use server';

import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type MfaState = { error?: string; factorId?: string; qr?: string; secret?: string };

/** Begins authenticator-app setup. Clears any abandoned, unverified setups first. */
export async function startEnrollment(): Promise<MfaState> {
  await requireRole(['admin'], '/security/mfa');
  const supabase = createClient();
  const { data: list } = await supabase.auth.mfa.listFactors();
  for (const f of (list?.all ?? []).filter((f) => f.status === 'unverified')) {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'LanceNest', friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}` });
  if (error || !data) return { error: 'Setup couldn’t start. Please try again.' };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Verifies a 6-digit code — completes setup, or upgrades this session to two-step (AAL2). */
export async function verifyCode(factorId: string, code: string): Promise<MfaState> {
  await requireRole(['admin'], '/security/mfa');
  const clean = code.replace(/\D/g, '');
  if (clean.length !== 6) return { error: 'Enter the 6-digit code from your authenticator app.' };
  const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId, code: clean });
  if (error) return { error: 'That code didn’t match. Codes refresh every 30 seconds — try the current one.' };
  redirect('/admin');
}
