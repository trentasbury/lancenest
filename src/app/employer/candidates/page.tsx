import PlanBadge from '@/components/PlanBadge';
import VerifiedMark from '@/components/VerifiedMark';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CLEARANCE_LABEL, CLEARANCE_ORDER, CLEARANCE_SEARCH, PAID, getMyCompany } from '@/lib/employer';
import { BRANCHES } from '@/lib/military';
import { sanitizeSearch } from '@/lib/format';
import Upsell from '@/components/employer/Upsell';
import Avatar from '@/components/network/Avatar';
import SubmitButton from '@/components/SubmitButton';
import { startConversation } from '@/app/messages/actions';

export const metadata: Metadata = { title: 'Candidate search' };

type Row = {
  profile_id: string; city: string | null; state: string | null; clearance_level: string; verification_status: string; willing_to_relocate: boolean; separation_date: string | null; skillbridge_interest: boolean; open_to_transition_hiring: boolean; plan: string; boosted_until: string | null;
  profile: { full_name: string; username: string | null; headline: string | null; service_summary: string | null } | null;
};
type F = { q?: string; branch?: string; mos?: string; state?: string; skill?: string; clearance?: string; verified?: string; relocate?: string; transitioning?: string };
const SELECT = 'profile_id, city, state, clearance_level, verification_status, willing_to_relocate, separation_date, skillbridge_interest, open_to_transition_hiring, plan, boosted_until, profile:profiles!veteran_profiles_profile_id_fkey(full_name, username, headline, service_summary)';

function intersect(a: string[] | null, b: string[]) {
  return a === null ? b : a.filter((x) => b.includes(x));
}

export default async function CandidatesPage({ searchParams: f }: { searchParams: F }) {
  const { user } = await requireRole(['employer'], '/employer/candidates');
  const company = await getMyCompany(user.id);
  if (!company) redirect('/employer/dashboard');
  const paid = PAID.includes(company.plan);
  const cleared = CLEARANCE_SEARCH.includes(company.plan);

  if (!company.is_verified) {
    return (
      <div className="container-page max-w-3xl py-12">
        <h1 className="mb-6 font-serif text-4xl font-medium">Candidate search</h1>
        <div className="card border-brass p-8 text-center">
          <p className="font-serif text-2xl">Verify your company first.</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">To protect veterans, candidate search opens once we’ve verified your company — usually within one business day.</p>
          <Link href="/employer/dashboard" className="btn btn-primary mt-6">Go to verification</Link>
        </div>
      </div>
    );
  }
  if (!paid) {
    return (
      <div className="container-page max-w-3xl py-12">
        <h1 className="mb-6 font-serif text-4xl font-medium">Candidate search</h1>
        <Upsell title="Find veterans before they find you." body="Search every veteran on LanceNest by branch, MOS, skills, location, and verification — then message them directly. Free plans see only candidates who apply." />
      </div>
    );
  }

  const supabase = createClient();
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
  if (f.transitioning) {
    const today = new Date().toISOString().slice(0, 10);
    const inAYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    query = query.eq('open_to_transition_hiring', true).gte('separation_date', today).lte('separation_date', inAYear);
  }
  if (cleared && f.clearance && CLEARANCE_ORDER.includes(f.clearance)) query = query.in('clearance_level', CLEARANCE_ORDER.slice(CLEARANCE_ORDER.indexOf(f.clearance)));
  const [{ data }, spotlight] = await Promise.all([
    query.order('verification_status', { ascending: false }).order('updated_at', { ascending: false }).limit(60),
    cleared && !Object.values(f).some(Boolean)
      ? supabase.from('veteran_profiles').select(SELECT).in('clearance_level', ['secret', 'top_secret', 'ts_sci']).order('verification_status', { ascending: false }).order('updated_at', { ascending: false }).limit(6)
      : Promise.resolve({ data: [] }),
  ]);
  // Placement perks: boosted profiles first, then Federal members (for federal employers), then Pro Plus / Federal.
  const now = Date.now();
  const rank = (r: Row) => (r.boosted_until && Date.parse(r.boosted_until) > now ? 4 : 0) + (cleared && r.plan === 'federal_pro' ? 2 : 0) + (['pro_plus', 'federal_pro'].includes(r.plan) ? 1 : 0);
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.profile).map((r, i) => ({ r, i })).sort((a, b) => rank(b.r) - rank(a.r) || a.i - b.i).map((x) => x.r);
  const spot = ((spotlight.data ?? []) as unknown as Row[]).filter((r) => r.profile);

  const Card = ({ r }: { r: Row }) => (
    <li className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <Avatar name={r.profile!.full_name} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {r.profile!.username ? <Link href={`/veterans/${r.profile!.username}`} className="hover:underline">{r.profile!.full_name}</Link> : r.profile!.full_name}
          {r.verification_status === 'verified' && <VerifiedMark />}<PlanBadge plan={r.plan} />
          {r.boosted_until && Date.parse(r.boosted_until) > Date.now() && <span className="ml-1.5 rounded-full bg-brass px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-[0.1em] text-navy">Featured</span>}
        </p>
        <p className="truncate text-sm text-muted">{[r.profile!.headline, r.profile!.service_summary].filter(Boolean).join(' · ')}</p>
        <p className="text-xs text-muted">
          {[r.city, r.state].filter(Boolean).join(', ') || 'Location not listed'}
          {r.willing_to_relocate && ' · Open to relocation'}
          {r.open_to_transition_hiring && r.separation_date && ` · Separating ${new Date(`${r.separation_date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
          {r.open_to_transition_hiring && r.skillbridge_interest && <span className="ml-2 rounded-full border border-olive/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-olive">SkillBridge interested</span>}
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
        <p className="text-sm text-muted">Messaging is free and unlimited.</p>
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
          <label className="flex items-center gap-2"><input type="checkbox" name="transitioning" value="1" defaultChecked={!!f.transitioning} className="accent-navy" />Transitioning (next 12 months)</label>
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

    </div>
  );
}
