import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CLEARANCE_LABEL, CLEARANCE_ORDER, CLEARANCE_SEARCH, PAID, contactUsage, getMyCompany } from '@/lib/employer';
import { BRANCHES } from '@/lib/military';
import { sanitizeSearch } from '@/lib/format';
import Upsell from '@/components/employer/Upsell';
import Avatar from '@/components/network/Avatar';
import SubmitButton from '@/components/SubmitButton';
import { startConversation } from '@/app/messages/actions';

export const metadata: Metadata = { title: 'Candidate search' };

type Row = {
  profile_id: string; city: string | null; state: string | null; clearance_level: string; verification_status: string; willing_to_relocate: boolean;
  profile: { full_name: string; username: string | null; headline: string | null; service_summary: string | null } | null;
};
type F = { q?: string; branch?: string; mos?: string; state?: string; skill?: string; clearance?: string; verified?: string; relocate?: string };
const SELECT = 'profile_id, city, state, clearance_level, verification_status, willing_to_relocate, profile:profiles!veteran_profiles_profile_id_fkey(full_name, username, headline, service_summary)';

function intersect(a: string[] | null, b: string[]) {
  return a === null ? b : a.filter((x) => b.includes(x));
}

export default async function CandidatesPage({ searchParams: f }: { searchParams: F }) {
  const { user } = await requireRole(['employer'], '/employer/candidates');
  const company = await getMyCompany(user.id);
  if (!company) redirect('/employer/dashboard');
  const paid = PAID.includes(company.plan);
  const cleared = CLEARANCE_SEARCH.includes(company.plan);

  if (!paid) {
    return (
      <div className="container-page max-w-3xl py-12">
        <h1 className="mb-6 font-serif text-4xl font-medium">Candidate search</h1>
        <Upsell title="Find veterans before they find you." body="Search every veteran on LanceNest by branch, MOS, skills, location, and verification — then message them directly. Free plans see only candidates who apply." />
      </div>
    );
  }

  const supabase = createClient();
  const usage = await contactUsage(company.id, company.plan);
  let ids: string[] | null = null;
  const q = sanitizeSearch(f.q ?? '');
  if (q) {
    const [{ data: byName }, { data: byAbout }] = await Promise.all([
      supabase.from('profiles').select('id').eq('role', 'veteran').or(`full_name.ilike.%${q}%,headline.ilike.%${q}%`).limit(500),
      supabase.from('veteran_profiles').select('profile_id').ilike('about', `%${q}%`).limit(500),
    ]);
    ids = intersect(ids, Array.from(new Set([...(byName ?? []).map((r) => r.id as string), ...(byAbout ?? []).map((r) => r.profile_id as string)])));
  }
  if (f.branch || f.mos) {
    let s = supabase.from('military_service').select('profile_id');
    if (f.branch) s = s.eq('branch', f.branch);
    if (f.mos) s = s.ilike('occupation_code', sanitizeSearch(f.mos));
    const { data } = await s.limit(1000);
    ids = intersect(ids, (data ?? []).map((r) => r.profile_id as string));
  }
  if (f.skill) {
    const { data } = await supabase.from('profile_skills').select('profile_id, skills!inner(name)').ilike('skills.name', `%${sanitizeSearch(f.skill)}%`).limit(1000);
    ids = intersect(ids, (data ?? []).map((r) => r.profile_id as string));
  }

  let query = supabase.from('veteran_profiles').select(SELECT);
  if (ids !== null) query = query.in('profile_id', ids.length ? ids.slice(0, 500) : ['00000000-0000-0000-0000-000000000000']);
  if (f.state) query = query.ilike('state', sanitizeSearch(f.state));
  if (f.verified) query = query.eq('verification_status', 'verified');
  if (f.relocate) query = query.eq('willing_to_relocate', true);
  if (cleared && f.clearance && CLEARANCE_ORDER.includes(f.clearance)) query = query.in('clearance_level', CLEARANCE_ORDER.slice(CLEARANCE_ORDER.indexOf(f.clearance)));
  const [{ data }, spotlight] = await Promise.all([
    query.order('verification_status', { ascending: false }).order('updated_at', { ascending: false }).limit(60),
    cleared && !Object.values(f).some(Boolean)
      ? supabase.from('veteran_profiles').select(SELECT).in('clearance_level', ['secret', 'top_secret', 'ts_sci']).order('verification_status', { ascending: false }).order('updated_at', { ascending: false }).limit(6)
      : Promise.resolve({ data: [] }),
  ]);
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.profile);
  const spot = ((spotlight.data ?? []) as unknown as Row[]).filter((r) => r.profile);

  const Card = ({ r }: { r: Row }) => (
    <li className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <Avatar name={r.profile!.full_name} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {r.profile!.username ? <Link href={`/veterans/${r.profile!.username}`} className="hover:underline">{r.profile!.full_name}</Link> : r.profile!.full_name}
          {r.verification_status === 'verified' && <span className="ml-1.5 text-brass-dark" title="Verified Veteran">✦</span>}
        </p>
        <p className="truncate text-sm text-muted">{[r.profile!.headline, r.profile!.service_summary].filter(Boolean).join(' · ')}</p>
        <p className="text-xs text-muted">
          {[r.city, r.state].filter(Boolean).join(', ') || 'Location not listed'}
          {r.willing_to_relocate && ' · Open to relocation'}
          {cleared && r.clearance_level !== 'none' && <span className="ml-2 rounded-full border border-brass/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-brass-dark">{CLEARANCE_LABEL[r.clearance_level]}</span>}
        </p>
      </div>
      <form action={startConversation.bind(null, r.profile_id)}>
        <SubmitButton className="btn btn-outline" pendingText="…">Message</SubmitButton>
      </form>
    </li>
  );

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/employer/dashboard" className="text-sm text-muted hover:text-navy">← Employer dashboard</Link>
          <h1 className="mt-2 font-serif text-4xl font-medium">Candidate search</h1>
        </div>
        <p className="text-sm text-muted">
          New contacts this month: {Number.isFinite(usage.limit) ? `${usage.used} of ${usage.limit}` : 'unlimited'}
          {company.contact_credits > 0 && ` · ${company.contact_credits} credit${company.contact_credits > 1 ? 's' : ''}`}
        </p>
      </div>

      <form className="card mt-6 grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4" method="get">
        <input name="q" defaultValue={f.q} placeholder="Name, title, or keyword" className="field lg:col-span-2" />
        <select name="branch" defaultValue={f.branch ?? ''} className="field"><option value="">Any branch</option>{BRANCHES.map((b) => <option key={b}>{b}</option>)}</select>
        <input name="mos" defaultValue={f.mos} placeholder="MOS / rating / AFSC" className="field" />
        <input name="skill" defaultValue={f.skill} placeholder="Skill" className="field" />
        <input name="state" defaultValue={f.state} placeholder="State (e.g. VA)" className="field" />
        {cleared ? (
          <select name="clearance" defaultValue={f.clearance ?? ''} className="field">
            <option value="">Any clearance</option>
            {CLEARANCE_ORDER.slice(1).map((c) => <option key={c} value={c}>{CLEARANCE_LABEL[c]} or higher</option>)}
          </select>
        ) : (
          <Link href="/employers" className="field flex items-center text-sm text-muted">Clearance filter · Federal plan</Link>
        )}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="verified" value="1" defaultChecked={!!f.verified} className="accent-navy" />Verified only</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="relocate" value="1" defaultChecked={!!f.relocate} className="accent-navy" />Will relocate</label>
        </div>
        <div className="flex gap-2 lg:col-span-4">
          <button className="btn btn-primary">Search</button>
          <Link href="/employer/candidates" className="btn btn-ghost">Clear</Link>
        </div>
      </form>

      {spot.length > 0 && (
        <section className="mt-8">
          <p className="eyebrow">Cleared talent spotlight</p>
          <ul className="mt-3 space-y-3">{spot.map((r) => <Card key={`s-${r.profile_id}`} r={r} />)}</ul>
        </section>
      )}

      <section className="mt-8">
        <p className="eyebrow">{rows.length === 60 ? 'Top 60 matches' : `${rows.length} candidate${rows.length === 1 ? '' : 's'}`}</p>
        {rows.length === 0 ? <p className="mt-4 text-sm text-muted">No veterans match those filters yet. Try widening your search.</p> : <ul className="mt-3 space-y-3">{rows.map((r) => <Card key={r.profile_id} r={r} />)}</ul>}
      </section>
      <p className="mt-6 text-xs text-muted">Messaging a candidate who applied to your jobs is always free. Each new candidate you contact first uses one monthly contact{company.plan === 'professional' ? ' (50 included)' : ''} or one purchased credit.</p>
    </div>
  );
}
