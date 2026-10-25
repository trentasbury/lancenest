import type { Metadata } from 'next';
import Link from 'next/link';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { BRANCHES } from '@/lib/military';
import { sanitizeSearch, initials } from '@/lib/format';
import { US_STATES } from '@/lib/states';
import { PERSON_COLS, mutualCounts, peopleGroups, viewerContext, type PersonCard } from '@/lib/people';
import Avatar from '@/components/network/Avatar';
import VerifiedMark from '@/components/VerifiedMark';
import SubmitButton from '@/components/SubmitButton';
import { followUser, unfollowUser } from '@/app/network/actions';
import { startConversation } from '@/app/messages/actions';

export const metadata: Metadata = { title: 'People' };

const PER_PAGE = 20;
type Search = { q?: string; branch?: string; location?: string; mos?: string; skill?: string; type?: string; page?: string };
type Row = Omit<PersonCard, 'reason' | 'mutual'>;

/**
 * People, laid out like LinkedIn's My Network: a search bar with filters, "manage my network" on the left, and
 * suggestions grouped by why you might know someone. A list of people only appears once you search.
 */
export default async function PeoplePage(props: { searchParams: Promise<Search> }) {
  const sp = await props.searchParams;
  const { user, profile } = await requireVerifiedMember('/people');
  const supabase = await createClient();
  const f = {
    q: sanitizeSearch(sp.q ?? ''),
    branch: (BRANCHES as readonly string[]).includes(sp.branch ?? '') ? sp.branch! : '',
    mos: sanitizeSearch(sp.mos ?? '').slice(0, 12),
    skill: sanitizeSearch(sp.skill ?? '').slice(0, 60),
    location: sanitizeSearch(sp.location ?? '').slice(0, 60),
    type: sp.type === 'veterans' || sp.type === 'employers' ? sp.type : '',
  };
  const searching = Object.values(f).some(Boolean);
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const href = (patch: Partial<typeof f> & { page?: number }) => {
    const next = { ...f, ...patch };
    const q = new URLSearchParams();
    (['q', 'branch', 'mos', 'skill', 'location', 'type'] as const).forEach((k) => { if (next[k]) q.set(k, next[k] as string); });
    if (patch.page && patch.page > 1) q.set('page', String(patch.page));
    return `/people${q.toString() ? `?${q}` : ''}`;
  };

  const [{ count: followingCount }, { count: followerCount }] = await Promise.all([
    supabase.from('user_follows').select('follower_id', { count: 'exact', head: true }).eq('follower_id', user.id),
    supabase.from('user_follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', user.id),
  ]);

  let results: PersonCard[] = [];
  let total = 0;
  let followSet = new Set<string>();
  let groups: Awaited<ReturnType<typeof peopleGroups>> = [];
  if (searching) {
    const ctx = await viewerContext(user.id, profile.role);
    followSet = ctx.followSet;
    // MOS and skill narrow the search to matching members first.
    const none = Promise.resolve({ data: null });
    const [{ data: mosRows }, { data: skillRows }] = await Promise.all([
      f.mos ? supabase.from('military_service').select('profile_id').ilike('occupation_code', f.mos).limit(1000) : none,
      f.skill ? supabase.from('profile_skills').select('profile_id, skills!inner(name)').ilike('skills.name', `%${f.skill}%`).limit(1000) : none,
    ]);
    let ids: string[] | null = null;
    if (f.mos) ids = ((mosRows ?? []) as { profile_id: string }[]).map((r) => r.profile_id);
    if (f.skill) {
      const s = new Set(((skillRows ?? []) as { profile_id: string }[]).map((r) => r.profile_id));
      ids = ids === null ? [...s] : ids.filter((x) => s.has(x));
    }
    let q = supabase.from('profiles').select(PERSON_COLS, { count: 'exact' }).in('role', ['veteran', 'employer', 'admin']);
    const out = [...ctx.leaveOut].slice(0, 300);
    if (out.length) q = q.not('id', 'in', `(${out.join(',')})`);
    if (f.q) q = q.or(`full_name.ilike.%${f.q}%,headline.ilike.%${f.q}%,service_summary.ilike.%${f.q}%`);
    if (f.branch) q = q.ilike('service_summary', `U.S. ${f.branch}%`);
    if (f.location) {
      const st = US_STATES.find(([c, n]) => c === f.location.toUpperCase() || n.toLowerCase() === f.location.toLowerCase());
      // Quoted, because the state code follows a comma ("Norfolk, VA").
      q = st ? q.or(`location.ilike."%, ${st[0]}",location.ilike."%${st[1]}%"`) : q.ilike('location', `%${f.location}%`);
    }
    if (f.type === 'veterans') q = q.eq('role', 'veteran'); else if (f.type === 'employers') q = q.eq('role', 'employer');
    if (ids !== null) q = q.in('id', ids.length ? ids.slice(0, 500) : ['00000000-0000-0000-0000-000000000000']);
    const from = (page - 1) * PER_PAGE;
    const { data, count } = await q.order('verified', { ascending: false }).order('created_at', { ascending: false }).range(from, from + PER_PAGE - 1);
    const rows = ((data ?? []) as Row[]).filter((r) => !ctx.leaveOut.has(r.id));
    const mutual = await mutualCounts(followSet, rows.map((r) => r.id));
    results = rows.map((r) => {
      const m = mutual.get(r.id) ?? 0;
      return { ...r, mutual: m, reason: m ? `Followed by ${m} ${m === 1 ? 'person' : 'people'} you follow` : '' };
    });
    total = count ?? results.length;
  } else {
    groups = await peopleGroups(user.id, profile.role);
  }
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const typeTabs: [string, string][] = [['', 'All'], ['veterans', 'Service members'], ['employers', 'Employers & recruiters']];

  return (
    <div className="container-page grid gap-6 py-8 lg:grid-cols-[260px_1fr]">
      <aside className="order-2 space-y-4 lg:order-1 lg:sticky lg:top-24 lg:self-start">
        <nav className="card overflow-hidden" aria-label="Manage my network">
          <p className="border-b border-line px-5 py-4 font-semibold text-ink">Manage my network</p>
          <ul className="py-2 text-sm">
            <li><Link href="/network/people?tab=following" className="flex items-center justify-between px-5 py-2 text-muted hover:bg-cream hover:text-navy">Following <span className="font-semibold text-navy">{followingCount ?? 0}</span></Link></li>
            <li><Link href="/network/people?tab=followers" className="flex items-center justify-between px-5 py-2 text-muted hover:bg-cream hover:text-navy">Followers <span className="font-semibold text-navy">{followerCount ?? 0}</span></Link></li>
            <li><Link href="/groups" className="block px-5 py-2 text-muted hover:bg-cream hover:text-navy">Groups</Link></li>
            <li><Link href="/mentors" className="block px-5 py-2 text-muted hover:bg-cream hover:text-navy">Mentors</Link></li>
            <li><Link href="/network/people?tab=blocked" className="block px-5 py-2 text-muted hover:bg-cream hover:text-navy">Muted & blocked</Link></li>
          </ul>
        </nav>
        {profile.username && (
          <div className="card p-5 text-sm">
            <p className="font-semibold text-ink">Stand out in searches</p>
            <p className="mt-1 text-muted">A headline, your job code and a few skills help the right people find you.</p>
            <Link href="/dashboard/profile" className="btn btn-outline mt-3 w-full">Edit my profile</Link>
          </div>
        )}
      </aside>

      <div className="order-1 min-w-0 space-y-5 lg:order-2">
        <form method="get" action="/people" role="search" className="card p-4 sm:p-5">
          <label htmlFor="people-q" className="sr-only">Search people</label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input id="people-q" name="q" defaultValue={f.q} maxLength={80} placeholder="Search by name, title or branch" className="field rounded-full pl-9" />
            </div>
            <button className="btn btn-primary shrink-0 rounded-full px-5">Search</button>
          </div>
          {f.type && <input type="hidden" name="type" value={f.type} />}
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <label className="sr-only" htmlFor="people-branch">Branch</label>
            <select id="people-branch" name="branch" defaultValue={f.branch} className="rounded-full border border-line bg-ivory px-3 py-1.5 text-ink hover:border-brass">
              <option value="">Any branch</option>{BRANCHES.map((b) => <option key={b}>{b}</option>)}
            </select>
            <label className="sr-only" htmlFor="people-mos">MOS, rating or AFSC</label>
            <input id="people-mos" name="mos" defaultValue={f.mos} maxLength={12} placeholder="MOS / rating / AFSC" className="w-40 rounded-full border border-line bg-ivory px-3 py-1.5 hover:border-brass" />
            <label className="sr-only" htmlFor="people-skill">Skill</label>
            <input id="people-skill" name="skill" defaultValue={f.skill} maxLength={60} placeholder="Skill" className="w-32 rounded-full border border-line bg-ivory px-3 py-1.5 hover:border-brass" />
            <label className="sr-only" htmlFor="people-loc">Location</label>
            <input id="people-loc" name="location" defaultValue={f.location} maxLength={60} placeholder="City or state" className="w-36 rounded-full border border-line bg-ivory px-3 py-1.5 hover:border-brass" />
            {searching && <Link href="/people" className="ml-auto self-center text-navy underline decoration-brass underline-offset-4">Clear</Link>}
          </div>
        </form>

        {searching ? (
          <section className="card">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
              {typeTabs.map(([v, l]) => (
                <Link key={v || 'all'} href={href({ type: v })} aria-current={f.type === v ? 'page' : undefined}
                  className={`rounded-full border px-3 py-1 text-sm ${f.type === v ? 'border-navy bg-navy text-ivory' : 'border-line text-ink hover:border-brass'}`}>{l}</Link>
              ))}
              <p className="ml-auto text-sm text-muted" aria-live="polite">{total === 0 ? 'No results' : `About ${total.toLocaleString()} ${total === 1 ? 'result' : 'results'}`}</p>
            </div>
            {results.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted">
                <p className="font-medium text-ink">No one matches that yet.</p>
                <p className="mt-1">Try fewer filters, or search a branch or job code.</p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {results.map((p) => {
                  const following = followSet.has(p.id);
                  return (
                    <li key={p.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <Avatar name={p.full_name} src={p.avatar_url} size="lg" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">
                            {(p.role === 'veteran' || p.role === 'admin') && p.username ? <Link href={`/veterans/${p.username}`} className="hover:underline">{p.full_name}</Link> : p.full_name}
                            {p.verified && <VerifiedMark />}
                            {following && <span className="ml-2 text-xs font-normal text-muted">· Following</span>}
                          </p>
                          <p className="line-clamp-2 text-sm text-ink">{p.headline || (p.role === 'employer' ? 'Employer' : 'Member')}</p>
                          <p className="truncate text-xs text-muted">{[p.service_summary, p.location].filter(Boolean).join(' · ')}</p>
                          {p.reason && <p className="mt-1 text-xs text-brass-dark">{p.reason}</p>}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2 sm:pl-3">
                        <form action={(following ? unfollowUser : followUser).bind(null, p.id)}>
                          <SubmitButton className={following ? 'btn btn-outline rounded-full px-4 py-1.5 text-sm' : 'btn btn-primary rounded-full px-4 py-1.5 text-sm'} pendingText="…">{following ? 'Following' : '+ Follow'}</SubmitButton>
                        </form>
                        <form action={startConversation.bind(null, p.id)}><SubmitButton className="btn btn-ghost rounded-full border border-line px-4 py-1.5 text-sm" pendingText="…">Message</SubmitButton></form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {pages > 1 && (
              <nav className="flex items-center justify-between border-t border-line px-5 py-3 text-sm" aria-label="Pages">
                {page > 1 ? <Link href={href({ page: page - 1 })} className="btn btn-outline">← Previous</Link> : <span />}
                <span className="text-muted">Page {page} of {pages}</span>
                {page < pages ? <Link href={href({ page: page + 1 })} className="btn btn-outline">Next →</Link> : <span />}
              </nav>
            )}
          </section>
        ) : groups.length === 0 ? (
          <section className="card p-8 text-center">
            <p className="font-serif text-2xl text-navy">Your network starts here</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">As more verified members join, people you may know will show up here: people from your branch, your job code, your state and the people you follow. Search above to find someone now.</p>
          </section>
        ) : (
          groups.map((g) => (
            <section key={g.key} className="card p-5" aria-labelledby={`grp-${g.key}`}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 id={`grp-${g.key}`} className="font-sans text-base font-semibold text-ink">{g.title}</h2>
                {g.more && <Link href={g.more} className="shrink-0 text-sm font-medium text-navy hover:underline">See all</Link>}
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {g.people.map((p) => <SuggestionCard key={p.id} p={p} />)}
              </ul>
            </section>
          ))
        )}
        {profile.role === 'employer' && <p className="text-xs text-muted">Messaging is free. Full service records, candidate search filters and analytics are part of the Professional and Federal plans.</p>}
      </div>
    </div>
  );
}

/** A "people you may know" card: cover band, photo, name, headline, why they're suggested, Follow. */
function SuggestionCard({ p }: { p: PersonCard }) {
  const name = <span className="font-semibold text-ink">{p.full_name}</span>;
  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-line bg-ivory text-center">
      <div className="h-12 bg-gradient-to-r from-navy-deep via-navy to-navy-soft" aria-hidden="true" />
      <div className="-mt-8 flex flex-1 flex-col items-center px-3 pb-3">
        {p.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatar_url} alt="" loading="lazy" className="h-16 w-16 rounded-full border-[3px] border-ivory object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-ivory bg-navy font-serif text-lg text-brass" aria-hidden="true">{initials(p.full_name)}</span>
        )}
        <p className="mt-2 line-clamp-2 max-w-full break-words leading-snug">
          {p.role === 'veteran' && p.username ? <Link href={`/veterans/${p.username}`} className="hover:underline">{name}</Link> : name}
          {p.verified && <VerifiedMark />}
        </p>
        <p className="mt-0.5 line-clamp-2 min-h-[2.5rem] text-xs text-muted">{p.headline || p.service_summary || (p.role === 'employer' ? 'Employer' : 'Member')}</p>
        <p className="mt-2 line-clamp-2 text-xs text-brass-dark">{p.reason}</p>
        <form action={followUser.bind(null, p.id)} className="mt-auto w-full pt-3">
          <SubmitButton className="btn btn-outline w-full rounded-full py-1.5 text-sm" pendingText="…">+ Follow</SubmitButton>
        </form>
      </div>
    </li>
  );
}
