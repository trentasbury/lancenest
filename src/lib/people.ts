import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stateOf } from '@/lib/place';

/**
 * The People page, the way LinkedIn's "My Network" works: suggestions grouped by why you might know someone
 * (people you follow follow them, same branch or job code, same state, shared skills), never a list of everyone.
 * Everything here is data members can already see; row-level security limits who comes back.
 */

export type PersonCard = {
  id: string; full_name: string; username: string | null; headline: string | null; service_summary: string | null;
  location: string | null; role: string; avatar_url: string | null; verified: boolean; reason: string; mutual: number;
};
export type PeopleGroup = { key: string; title: string; more?: string; people: PersonCard[] };
type Row = Omit<PersonCard, 'reason' | 'mutual'>;

export const PERSON_COLS = 'id, full_name, username, headline, service_summary, location, role, avatar_url, verified';
export const branchOf = (summary: string | null) => summary?.match(/^U\.S\. ([^·]+)/)?.[1]?.trim() ?? null;
export const stateFrom = (location: string | null) => stateOf(location?.split(',').pop()?.trim() ?? null);

/** Who the viewer follows and has blocked, and (for employers) members to leave out. */
export async function viewerContext(viewerId: string, role: string) {
  const supabase = await createClient();
  const [{ data: following }, { data: blocks }, hiding, hidden] = await Promise.all([
    supabase.from('user_follows').select('following_id').eq('follower_id', viewerId),
    supabase.from('user_blocks').select('blocked_id').eq('blocker_id', viewerId),
    role === 'employer' ? supabase.rpc('members_hiding_me') : Promise.resolve({ data: [] }),
    // Members who turned off "Visible to verified employers" never appear to employers here either.
    role === 'employer' ? createAdminClient().from('veteran_profiles').select('profile_id').eq('is_public', false).limit(5000) : Promise.resolve({ data: [] }),
  ]);
  const followSet = new Set((following ?? []).map((r) => r.following_id as string));
  const leaveOut = new Set<string>([
    viewerId,
    ...(blocks ?? []).map((r) => r.blocked_id as string),
    ...((hiding.data ?? []) as string[]),
    ...(((hidden.data ?? []) as { profile_id: string }[]).map((r) => r.profile_id)),
  ]);
  return { followSet, leaveOut };
}

/** For each person, how many of the people the viewer follows also follow them. */
export async function mutualCounts(followSet: Set<string>, ids: string[]) {
  const out = new Map<string, number>();
  if (!followSet.size || !ids.length) return out;
  const { data } = await (await createClient()).from('user_follows').select('following_id')
    .in('follower_id', [...followSet].slice(0, 500)).in('following_id', ids.slice(0, 500)).limit(5000);
  (data ?? []).forEach((r) => out.set(r.following_id as string, (out.get(r.following_id as string) ?? 0) + 1));
  return out;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export async function peopleGroups(viewerId: string, role: string): Promise<PeopleGroup[]> {
  const supabase = await createClient();
  const { followSet, leaveOut } = await viewerContext(viewerId, role);
  const [{ data: me }, { data: myService }, { data: mySkills }, { data: pool }, { data: verifiedCos }] = await Promise.all([
    supabase.from('profiles').select('service_summary, location').eq('id', viewerId).maybeSingle(),
    supabase.from('military_service').select('occupation_code').eq('profile_id', viewerId),
    supabase.from('profile_skills').select('skill_id').eq('profile_id', viewerId),
    supabase.from('profiles').select(PERSON_COLS).in('role', ['veteran', 'employer']).order('created_at', { ascending: false }).limit(400),
    supabase.from('companies').select('owner_id').eq('is_verified', true).not('owner_id', 'is', null).limit(2000),
  ]);
  const hiringOwners = new Set((verifiedCos ?? []).map((c) => c.owner_id as string));
  // Suggestions are verified members, and employers whose company LanceNest verified. Already-followed people are left out.
  const candidates = ((pool ?? []) as Row[]).filter((p) => !leaveOut.has(p.id) && !followSet.has(p.id)
    && (p.role === 'employer' ? hiringOwners.has(p.id) : p.verified));
  if (!candidates.length) return [];
  const ids = candidates.map((c) => c.id);

  const myCodes = new Set(((myService ?? []) as { occupation_code: string | null }[]).map((s) => s.occupation_code?.trim().toUpperCase()).filter(Boolean) as string[]);
  const skillIds = (mySkills ?? []).map((r) => r.skill_id as string);
  const [mutual, { data: theirService }, { data: theirSkills }] = await Promise.all([
    mutualCounts(followSet, ids),
    myCodes.size ? supabase.from('military_service').select('profile_id, occupation_code').in('profile_id', ids) : Promise.resolve({ data: [] }),
    skillIds.length ? supabase.from('profile_skills').select('profile_id').in('skill_id', skillIds).in('profile_id', ids).limit(5000) : Promise.resolve({ data: [] }),
  ]);
  const sameCode = new Map<string, string>();
  ((theirService ?? []) as { profile_id: string; occupation_code: string | null }[]).forEach((s) => {
    const c = s.occupation_code?.trim().toUpperCase();
    if (c && myCodes.has(c)) sameCode.set(s.profile_id, c);
  });
  const shared = new Map<string, number>();
  ((theirSkills ?? []) as { profile_id: string }[]).forEach((r) => shared.set(r.profile_id, (shared.get(r.profile_id) ?? 0) + 1));

  const myBranch = branchOf(me?.service_summary ?? null);
  const myState = stateFrom(me?.location ?? null);
  const groups: Record<string, PersonCard[]> = { mutual: [], service: [], near: [], skills: [], hiring: [], recent: [] };
  for (const c of candidates) {
    const m = mutual.get(c.id) ?? 0;
    const code = sameCode.get(c.id);
    const branch = branchOf(c.service_summary);
    const st = stateFrom(c.location);
    const skills = shared.get(c.id) ?? 0;
    const mutualLine = m ? `Followed by ${plural(m, 'person you follow', 'people you follow')}` : '';
    const card = (reason: string): PersonCard => ({ ...c, reason, mutual: m });
    if (m >= 1) groups.mutual.push(card(mutualLine));
    else if (c.role === 'employer') groups.hiring.push(card(myState && st && st[0] === myState[0] ? `Hiring in ${st[1]}` : 'Hiring at a verified employer'));
    else if (c.role === 'veteran' && code) groups.service.push(card(`Also a ${code}`));
    else if (c.role === 'veteran' && myBranch && branch === myBranch) groups.service.push(card(`Also served in the ${branch}`));
    else if (myState && st && st[0] === myState[0]) groups.near.push(card(`Also in ${st[1]}`));
    else if (skills) groups.skills.push(card(`${plural(skills, 'shared skill')}`));
    else groups.recent.push(card('New to LanceNest'));
  }
  // Strongest matches first inside each group: more mutual follows, then the same job code, then shared skills.
  const rank = (p: PersonCard) => p.mutual * 10 + (sameCode.has(p.id) ? 5 : 0) + (shared.get(p.id) ?? 0);
  Object.values(groups).forEach((g) => g.sort((a, b) => rank(b) - rank(a)));

  const out: PeopleGroup[] = [
    { key: 'mutual', title: 'Followed by people you follow', people: groups.mutual },
    { key: 'service', title: myBranch ? `Served like you: ${myBranch}` : 'Served like you', more: myBranch ? `/people?branch=${encodeURIComponent(myBranch)}` : undefined, people: groups.service },
    { key: 'near', title: myState ? `Near you in ${myState[1]}` : 'Near you', more: myState ? `/people?location=${encodeURIComponent(myState[0])}` : undefined, people: groups.near },
    { key: 'skills', title: 'Share your skills', people: groups.skills },
    { key: 'hiring', title: role === 'employer' ? 'Other employers hiring veterans' : 'Recruiters at verified employers', more: '/people?type=employers', people: groups.hiring },
    { key: 'recent', title: 'New to LanceNest', people: groups.recent },
  ];
  return out.filter((g) => g.people.length).map((g) => ({ ...g, people: g.people.slice(0, 8) }));
}
