import type { SupabaseClient } from '@supabase/supabase-js';

/** Kinds of member-started groups, with the labels and examples members see. */
export const GROUP_CATEGORIES: { value: string; label: string; example: string }[] = [
  { value: 'unit', label: 'Unit & shipmates', example: '2nd Battalion, 5th Marines (2008–2012)' },
  { value: 'faith', label: 'Faith & fellowship', example: 'Christian veterans fellowship' },
  { value: 'friends', label: 'Friends', example: 'Boot camp platoon 1043 friends' },
  { value: 'spouses', label: 'Spouses & families', example: 'Fort Bragg-area military spouses' },
  { value: 'location', label: 'Local & base community', example: 'San Diego veterans' },
  { value: 'business', label: 'Veteran business owners', example: 'Veteran-owned contractors' },
  { value: 'interest', label: 'Hobbies & interests', example: 'Veteran anglers' },
  { value: 'support', label: 'Peer support', example: 'Transition peer check-ins' },
  { value: 'other', label: 'Something else', example: '' },
];
export const categoryLabel = (c: string | null | undefined) => GROUP_CATEGORIES.find((x) => x.value === c)?.label ?? null;

/** LanceNest's own groups, by kind. */
export const OFFICIAL_KINDS: [string, string][] = [['branch', 'Branches'], ['career', 'Careers'], ['transition', 'Transition classes'], ['state', 'States']];

export type GroupRow = {
  id: string; slug: string; name: string; kind: string | null; category: string | null; description: string | null;
  privacy: 'open' | 'private'; status: string; created_by: string | null;
};
export const GROUP_COLUMNS = 'id, slug, name, kind, category, description, privacy, status, created_by';

/** Active member counts, including private groups (the list itself stays private). */
export async function groupCounts(supabase: SupabaseClient, ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const { data } = await supabase.rpc('group_member_counts', { ids });
  ((data ?? []) as { group_id: string; members: number }[]).forEach((r) => out.set(r.group_id, Number(r.members)));
  return out;
}

/**
 * The member's groups and a few suggestions from their profile: their branch (the Marine Corps group, say), their
 * state, and their separation year. Used by the Network home and the Groups page.
 */
export async function myGroupsAndSuggestions(supabase: SupabaseClient, userId: string) {
  const [{ data: mine }, { data: svc }, { data: vet }] = await Promise.all([
    supabase.from('group_members').select(`status, role, group:groups(${GROUP_COLUMNS})`).eq('profile_id', userId),
    supabase.from('military_service').select('branch').eq('profile_id', userId),
    supabase.from('veteran_profiles').select('state, separation_date').eq('profile_id', userId).maybeSingle(),
  ]);
  type M = { status: string; role: string; group: GroupRow | null };
  const rows = ((mine ?? []) as unknown as M[]).filter((m) => m.group && m.group.status === 'approved');
  const joined = rows.filter((m) => m.status === 'active').map((m) => ({ ...m.group!, role: m.role }));
  const requested = new Set(rows.filter((m) => m.status === 'pending').map((m) => m.group!.id));
  const have = new Set(rows.map((m) => m.group!.id));

  const slugs = new Set<string>();
  (svc ?? []).forEach((s) => s.branch && slugs.add(String(s.branch).toLowerCase().replace(/\s+/g, '-')));
  if (vet?.state) slugs.add(`state-${String(vet.state).toLowerCase()}`);
  if (vet?.separation_date) slugs.add(`separating-${new Date(String(vet.separation_date)).getFullYear()}`);
  let suggested: GroupRow[] = [];
  if (slugs.size) {
    const { data } = await supabase.from('groups').select(GROUP_COLUMNS).in('slug', [...slugs]).not('kind', 'is', null).eq('status', 'approved');
    suggested = ((data ?? []) as GroupRow[]).filter((g) => !have.has(g.id));
  }
  return { joined, requested, suggested };
}

const RESERVED = /\b(official|lancenest|lance nest|admins?|administrators?|moderators?|staff|support team)\b/i;

/** Words a member-started group can't use in its name, so no group looks official or run by LanceNest. */
export function reservedGroupName(name: string): boolean {
  return RESERVED.test(name);
}
