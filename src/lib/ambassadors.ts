import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/** Active ambassadors earn a free month of Pro for every verified member they bring (no yearly cap). */
export const AMBASSADOR_MONTH_DAYS = 30;

export async function isActiveAmbassador(profileId: string) {
  const { data } = await createAdminClient().from('ambassadors').select('status').eq('profile_id', profileId).maybeSingle();
  return data?.status === 'active';
}

export async function ambassadorStatus(profileId: string) {
  const { data } = await createAdminClient().from('ambassadors').select('status, installation, applied_at').eq('profile_id', profileId).maybeSingle();
  return data as { status: string; installation: string; applied_at: string } | null;
}

/** Adds a free month of Pro (or extends the member's current free grant). */
export async function grantAmbassadorMonth(profileId: string) {
  const admin = createAdminClient();
  const { data: v } = await admin.from('veteran_profiles').select('granted_plan, pro_granted_until').eq('profile_id', profileId).maybeSingle();
  const active = v?.granted_plan && v.pro_granted_until && Date.parse(v.pro_granted_until as string) > Date.now();
  const base = active ? Date.parse(v!.pro_granted_until as string) : Date.now();
  await admin.from('veteran_profiles').update({ granted_plan: active ? v!.granted_plan : 'pro', pro_granted_until: new Date(base + AMBASSADOR_MONTH_DAYS * 86400000).toISOString() }).eq('profile_id', profileId);
  const { recomputeVeteran } = await import('@/lib/billing');
  await recomputeVeteran(profileId);
}
