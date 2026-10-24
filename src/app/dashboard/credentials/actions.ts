'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { LICENSED_TRADES } from '@/lib/flags';
import { US_STATES } from '@/lib/states';

const PAGE = '/dashboard/credentials';
const t = (f: FormData, k: string, max: number) => String(f.get(k) ?? '').trim().slice(0, max);

/** Opens a review for a license or certificate. The proof file is in the member's own private folder. */
export async function submitCredential(formData: FormData) {
  const { user, profile } = await requireVerifiedMember(PAGE);
  if (profile.role !== 'veteran') redirect('/dashboard');
  const kind = t(formData, 'kind', 12) === 'license' ? 'license' : 'certificate';
  const name = t(formData, 'name', 120);
  const issuer = t(formData, 'issuer', 120) || null;
  const trade = kind === 'license' ? t(formData, 'trade', 60) : '';
  const state = kind === 'license' ? t(formData, 'state', 2).toUpperCase() : '';
  const number = kind === 'license' ? t(formData, 'number', 60) : '';
  const expires = t(formData, 'expires_on', 10);
  const path = t(formData, 'document_path', 200);
  if (name.length < 2) redirect(`${PAGE}?error=name`);
  if (kind === 'license' && (!LICENSED_TRADES.includes(trade) || !US_STATES.some(([c]) => c === state) || !number)) redirect(`${PAGE}?error=license`);
  if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) redirect(`${PAGE}?error=date`);
  if (expires && expires < new Date().toISOString().slice(0, 10)) redirect(`${PAGE}?error=expired`);
  if (!new RegExp(`^${user.id}/\\d+-credential\\.(pdf|jpg|png)$`).test(path)) redirect(`${PAGE}?error=file`);

  const supabase = await createClient();
  const { data: files } = await supabase.storage.from('verification-docs').list(user.id, { limit: 200 });
  if (!(files ?? []).some((f) => `${user.id}/${f.name}` === path)) redirect(`${PAGE}?error=file`);
  const admin = createAdminClient();
  const { count } = await admin.from('credentials').select('id', { count: 'exact', head: true }).eq('profile_id', user.id).eq('status', 'pending');
  if ((count ?? 0) >= 5) { await supabase.storage.from('verification-docs').remove([path]); redirect(`${PAGE}?error=pending`); }
  const { error } = await admin.from('credentials').insert({ profile_id: user.id, kind, name, issuer, trade: trade || null, state: state || null, number: number || null, expires_on: expires || null, document_path: path });
  if (error) { console.error('credential failed:', error.message); await supabase.storage.from('verification-docs').remove([path]); redirect(`${PAGE}?error=save`); }
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  if (admins?.length) await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'verification', title: `A ${kind} is waiting for review: ${name}`, link: '/admin/credentials' })));
  revalidatePath(PAGE);
  redirect(`${PAGE}?submitted=1`);
}

export async function removeCredential(id: string) {
  const { user } = await requireVerifiedMember(PAGE);
  const admin = createAdminClient();
  const { data: c } = await admin.from('credentials').select('document_path').eq('id', id).eq('profile_id', user.id).maybeSingle();
  if (c?.document_path) await admin.storage.from('verification-docs').remove([c.document_path as string]);
  await admin.from('credentials').delete().eq('id', id).eq('profile_id', user.id);
  revalidatePath(PAGE);
  redirect(PAGE);
}
