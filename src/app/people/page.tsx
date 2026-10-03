import type { Metadata } from 'next';
import Link from 'next/link';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { BRANCHES } from '@/lib/military';
import { sanitizeSearch } from '@/lib/format';
import Avatar from '@/components/network/Avatar';
import VerifiedMark from '@/components/VerifiedMark';
import SubmitButton from '@/components/SubmitButton';
import { followUser, unfollowUser } from '@/app/network/actions';
import { startConversation } from '@/app/messages/actions';

export const metadata: Metadata = { title: 'People' };
type Person = { id: string; avatar_url: string | null; full_name: string; username: string | null; headline: string | null; location: string | null; service_summary: string | null; verified: boolean; role: string };

export default async function PeoplePage({ searchParams: f }: { searchParams: { q?: string; branch?: string; location?: string; mos?: string; skill?: string; type?: string } }) {
  const { user, profile } = await requireVerifiedMember('/people');
  const supabase = createClient();
  let ids: string[] | null = null;
  if (f.mos) {
    const { data } = await supabase.from('military_service').select('profile_id').ilike('occupation_code', sanitizeSearch(f.mos)).limit(1000);
    ids = (data ?? []).map((r) => r.profile_id as string);
  }
  if (f.skill) {
    const { data } = await supabase.from('profile_skills').select('profile_id, skills!inner(name)').ilike('skills.name', `%${sanitizeSearch(f.skill)}%`).limit(1000);
    const s = (data ?? []).map((r) => r.profile_id as string);
    ids = ids === null ? s : ids.filter((x) => s.includes(x));
  }
  // Row-level security returns only members the viewer may see (verified, not removed).
  let q = supabase.from('profiles').select('id, full_name, username, headline, location, service_summary, verified, role, avatar_url').neq('id', user.id);
  if (profile.role === 'employer') {
    const { data: hiding } = await supabase.rpc('members_hiding_me');
    const hid = ((hiding ?? []) as string[]);
    if (hid.length) q = q.not('id', 'in', `(${hid.join(',')})`);
  }
  const kw = sanitizeSearch(f.q ?? '');
  if (kw) q = q.or(`full_name.ilike.%${kw}%,headline.ilike.%${kw}%`);
  if (f.branch && (BRANCHES as readonly string[]).includes(f.branch)) q = q.ilike('service_summary', `%${f.branch}%`);
  if (f.location) q = q.ilike('location', `%${sanitizeSearch(f.location)}%`);
  if (f.type === 'veterans') q = q.eq('role', 'veteran'); else if (f.type === 'employers') q = q.eq('role', 'employer');
  if (ids !== null) q = q.in('id', ids.length ? ids.slice(0, 500) : ['00000000-0000-0000-0000-000000000000']);
  const [{ data }, { data: following }] = await Promise.all([
    q.order('verified', { ascending: false }).order('created_at', { ascending: false }).limit(60),
    supabase.from('user_follows').select('following_id').eq('follower_id', user.id),
  ]);
  const people = (data ?? []) as Person[];
  const followSet = new Set((following ?? []).map((r) => r.following_id as string));

  return (
    <div className="container-page py-10">
      <h1 className="font-serif text-4xl font-medium">People</h1>
      <p className="mt-1 text-muted">Find and connect with verified service members and the companies hiring them.</p>
      <form method="get" className="card mt-6 grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-6">
        <input name="q" defaultValue={f.q} placeholder="Name or title" className="field lg:col-span-2" />
        <select name="branch" defaultValue={f.branch ?? ''} className="field"><option value="">Any branch</option>{BRANCHES.map((b) => <option key={b}>{b}</option>)}</select>
        <input name="mos" defaultValue={f.mos} placeholder="MOS / rating / AFSC" className="field" />
        <input name="skill" defaultValue={f.skill} placeholder="Skill" className="field" />
        <input name="location" defaultValue={f.location} placeholder="City or state" className="field" />
        <select name="type" defaultValue={f.type ?? ''} className="field"><option value="">Everyone</option><option value="veterans">Service members</option><option value="employers">Employers & recruiters</option></select>
        <div className="flex gap-2 lg:col-span-5"><button className="btn btn-primary">Search</button><Link href="/people" className="btn btn-ghost">Clear</Link></div>
      </form>
      <p className="eyebrow mt-8">{people.length === 60 ? 'Top 60 results' : `${people.length} ${people.length === 1 ? 'person' : 'people'}`}</p>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {people.map((p) => (
          <li key={p.id} className="card flex items-center gap-3 p-4">
            <Avatar name={p.full_name} src={p.avatar_url} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {(p.role === 'veteran' || p.role === 'admin') && p.username ? <Link href={`/veterans/${p.username}`} className="hover:underline">{p.full_name}</Link> : p.full_name}
                {p.verified && <VerifiedMark />}
              </p>
              <p className="truncate text-xs text-muted">{[p.headline, p.service_summary, p.location].filter(Boolean).join(' · ') || (p.role === 'employer' ? 'Employer' : 'Member')}</p>
            </div>
            <form action={startConversation.bind(null, p.id)}><SubmitButton className="btn btn-ghost border border-line px-3 py-1.5 text-xs" pendingText="…">Message</SubmitButton></form>
            <form action={(followSet.has(p.id) ? unfollowUser : followUser).bind(null, p.id)}>
              <SubmitButton className={followSet.has(p.id) ? 'btn btn-outline px-3 py-1.5 text-xs' : 'btn btn-primary px-3 py-1.5 text-xs'} pendingText="…">{followSet.has(p.id) ? 'Following' : 'Follow'}</SubmitButton>
            </form>
          </li>
        ))}
      </ul>
      {profile.role === 'employer' && <p className="mt-6 text-xs text-muted">Messaging is free. Full service records, candidate search filters, and analytics are part of Professional and Federal plans.</p>}
    </div>
  );
}
