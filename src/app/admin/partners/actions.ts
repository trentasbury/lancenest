'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { randomInt } from 'node:crypto';

export async function createPartnerCode(formData: FormData) {
  const { user } = await requireAdmin('/admin/partners');
  const code = String(formData.get('code') ?? '').trim().toUpperCase().replace(/\s+/g, '-');
  const partner = String(formData.get('partner') ?? '').trim().slice(0, 120);
  const months = 6; // every card is the one member offer: 6 months of Pro, once (approved November 6, 2026)
  const maxUses = Number.parseInt(String(formData.get('max_uses') ?? ''), 10);
  const expires = String(formData.get('expires') ?? '');
  if (!/^[A-Z0-9-]{4,32}$/.test(code) || partner.length < 2) redirect('/admin/partners?error=input');
  const { error } = await createAdminClient().from('partner_codes').insert({
    code, partner_name: partner, months, max_uses: Number.isFinite(maxUses) && maxUses > 0 ? maxUses : null,
    expires_at: /^\d{4}-\d{2}-\d{2}$/.test(expires) ? `${expires}T23:59:59Z` : null, created_by: user.id,
  });
  if (error) redirect(`/admin/partners?error=${error.code === '23505' ? 'taken' : 'input'}`);
  await createAdminClient().from('admin_actions').insert({ admin_id: user.id, action: 'partner_code_created', target_type: 'partner_code', target_id: null, details: { code, partner, months } });
  revalidatePath('/admin/partners');
  redirect('/admin/partners?saved=1');
}

export async function setPartnerCodeActive(id: string, active: boolean) {
  const { user } = await requireAdmin('/admin/partners');
  await createAdminClient().from('partner_codes').update({ active }).eq('id', id);
  await createAdminClient().from('admin_actions').insert({ admin_id: user.id, action: active ? 'partner_code_on' : 'partner_code_off', target_type: 'partner_code', target_id: id, details: {} });
  revalidatePath('/admin/partners');
}

// One-time cards: no 0/O or 1/I, so a code read off a card can't be mistyped into someone else's.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function cardCode() {
  const pick = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `LN-${pick()}-${pick()}`;
}

/**
 * A batch of one-time cards for one base, transition office or program. Each card has its own code and works once
 * (a leaked card is one person's 6 months, not everyone's). Unused cards expire 6 months after the batch is made.
 */
export async function createPartnerBatch(formData: FormData) {
  const { user } = await requireAdmin('/admin/partners');
  const partner = String(formData.get('partner') ?? '').trim().slice(0, 120);
  const count = Math.min(500, Math.max(1, Number.parseInt(String(formData.get('count') ?? '50'), 10) || 50));
  const months = 6; // every card is the one member offer: 6 months of Pro, once (approved November 6, 2026)
  // Cards work for any verified member who's handed one, transitioning or not (approved October 31, 2026); one use each.
  const transitionOnly = false;
  if (partner.length < 2) redirect('/admin/partners?error=input');
  const expires = new Date();
  expires.setUTCMonth(expires.getUTCMonth() + 6);
  const admin = createAdminClient();
  const { data: batch, error } = await admin.from('partner_batches').insert({
    partner_name: partner, months, card_count: count, transition_only: transitionOnly, expires_at: expires.toISOString(), created_by: user.id,
  }).select('id').single();
  if (error || !batch) redirect('/admin/partners?error=save');
  const codes = new Set<string>();
  while (codes.size < count) codes.add(cardCode());
  const rows = [...codes].map((code) => ({
    code, partner_name: partner, months, max_uses: 1, expires_at: expires.toISOString(), created_by: user.id, batch_id: batch.id, transition_only: transitionOnly,
  }));
  const { error: e2 } = await admin.from('partner_codes').insert(rows);
  if (e2) { await admin.from('partner_batches').update({ voided_at: new Date().toISOString() }).eq('id', batch.id); redirect('/admin/partners?error=save'); }
  await admin.from('admin_actions').insert({ admin_id: user.id, action: 'partner_batch_created', target_type: 'partner_batch', target_id: batch.id, details: { partner, count, months, transition_only: transitionOnly } });
  revalidatePath('/admin/partners');
  redirect(`/admin/partners/batch/${batch.id}`);
}

/** Stops every unused card in a batch (lost or leaked stack). Cards already used keep their Pro. */
export async function voidPartnerBatch(batchId: string) {
  const { user } = await requireAdmin('/admin/partners');
  const admin = createAdminClient();
  await admin.from('partner_batches').update({ voided_at: new Date().toISOString() }).eq('id', batchId).is('voided_at', null);
  await admin.from('partner_codes').update({ active: false }).eq('batch_id', batchId).eq('uses', 0);
  await admin.from('admin_actions').insert({ admin_id: user.id, action: 'partner_batch_voided', target_type: 'partner_batch', target_id: batchId, details: {} });
  revalidatePath('/admin/partners');
}
