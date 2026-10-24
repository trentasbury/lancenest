'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function createPartnerCode(formData: FormData) {
  const { user } = await requireAdmin('/admin/partners');
  const code = String(formData.get('code') ?? '').trim().toUpperCase().replace(/\s+/g, '-');
  const partner = String(formData.get('partner') ?? '').trim().slice(0, 120);
  const months = Math.min(12, Math.max(1, Number.parseInt(String(formData.get('months') ?? '6'), 10) || 6));
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
