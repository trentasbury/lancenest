import type { Metadata } from 'next';
import Link from 'next/link';
import { requireFreelanceAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CATEGORIES, FREE_PROPOSALS_PER_MONTH, proposalCredits, proposalsUsedThisMonth } from '@/lib/freelance';
import ProposalPackForm from '@/components/freelance/ProposalPackForm';
import { FREELANCE_PAYMENTS_ENABLED } from '@/lib/flags';
import { CLEARANCE_LABEL } from '@/lib/employer';
import { sanitizeSearch } from '@/lib/format';
import { timeAgo } from '@/lib/network';
import FreelanceTabs from '@/components/freelance/FreelanceTabs';

export const metadata: Metadata = { title: 'Freelance' };

type Project = { id: string; title: string; description: string; category: string | null; budget_type: string; budget_min: number | null; budget_max: number | null; clearance_required: string; status: string; created_at: string; company: { name: string; is_verified: boolean } | null };
const budget = (p: Project) => (p.budget_min || p.budget_max) ? `$${(p.budget_min ?? p.budget_max)!.toLocaleString()}${p.budget_max && p.budget_min && p.budget_max !== p.budget_min ? `–$${p.budget_max.toLocaleString()}` : ''}${p.budget_type === 'hourly' ? '/hr' : ''}` : 'Budget open';

export default async function FreelancePage(
  props: { searchParams: Promise<{ q?: string; category?: string; cleared?: string; mine?: string }> }
) {
  const searchParams = await props.searchParams;
  const { user, profile } = await requireFreelanceAccess('/freelance');
  const supabase = await createClient();
  const isVet = profile.role === 'veteran';
  const [{ data: fp }, { data: vet }] = isVet
    ? await Promise.all([
        supabase.from('freelancer_profiles').select('title, payouts_enabled').eq('profile_id', user.id).maybeSingle(),
        supabase.from('veteran_profiles').select('plan').eq('profile_id', user.id).maybeSingle(),
      ])
    : [{ data: null }, { data: null }];
  const plan = (vet?.plan as string) ?? 'free';
  const [used, credits] = isVet ? await Promise.all([proposalsUsedThisMonth(user.id), plan === 'free' ? proposalCredits(user.id) : 0]) : [0, 0];
  const { data: contracts } = await supabase.from('contracts').select('id, title, status').or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`).order('created_at', { ascending: false }).limit(10);

  let q = supabase.from('freelance_projects').select('id, title, description, category, work_location, budget_type, budget_min, budget_max, clearance_required, status, created_at, company:companies(name, is_verified)');
  const isClient = profile.role === 'client';
  // Clients see only their own projects (other people's projects are for members).
  const mine = isClient || (!isVet && searchParams.mine !== '0');
  if (mine) q = q.eq('client_id', user.id); else q = q.eq('status', 'open');
  const kw = sanitizeSearch(searchParams.q ?? '');
  if (kw) q = q.textSearch('search', kw, { type: 'websearch', config: 'english' });
  if (searchParams.category && CATEGORIES.includes(searchParams.category)) q = q.eq('category', searchParams.category);
  if (searchParams.cleared) q = q.neq('clearance_required', 'none');
  const { data } = await q.order('created_at', { ascending: false }).limit(50);
  const projects = (data ?? []) as unknown as Project[];

  const proposalsLine = isVet && (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="text-ink/85">Proposals this month: <strong className="text-navy">{plan === 'free' ? `${Math.min(used, FREE_PROPOSALS_PER_MONTH)} of ${FREE_PROPOSALS_PER_MONTH} free` : `${used} · unlimited`}</strong></span>
      {plan === 'free' && credits > 0 && <span className="text-xs font-medium text-olive">+ {credits} extra ready to use</span>}
      {plan === 'free' && <><ProposalPackForm back="/freelance" /><Link href="/plans" className="text-xs text-navy underline hover:text-brass-dark">Unlimited with Pro →</Link></>}
    </div>
  );

  const searchForm = !isClient && (
    <form method="get" action={isVet ? '/freelance#projects' : undefined} className="card mb-6 grid gap-3 p-5 sm:grid-cols-4">
      <input name="q" defaultValue={searchParams.q} placeholder="Search projects (e.g. diesel repair, web design, logistics, cyber)" className="field sm:col-span-2" />
      <select name="category" defaultValue={searchParams.category ?? ''} className="field"><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="cleared" value="1" defaultChecked={!!searchParams.cleared} className="accent-navy" />Cleared work only</label>
      {!isVet && <input type="hidden" name="mine" value={mine ? '1' : '0'} />}
      <div className="flex gap-2 sm:col-span-4"><button className="btn btn-primary">Search</button>
        {!isVet && !isClient && <Link href={mine ? '/freelance?mine=0' : '/freelance'} className="btn btn-ghost border border-line">{mine ? 'Browse all open projects' : 'Your projects'}</Link>}
      </div>
    </form>
  );

  const projectList = (
    <>
      <p className="eyebrow">{mine ? 'Your projects' : `${projects.length} open project${projects.length === 1 ? '' : 's'}`}</p>
      {projects.length === 0 ? (
        <div className="card mt-3 p-8 text-center text-muted">
          {mine ? 'You haven’t posted a project yet.' : 'No open projects match that search yet — check back soon, or offer a service so clients can find you.'}
          {isVet && <div className="mt-4"><Link href="/freelance/services/mine" className="btn btn-outline">Offer your services</Link></div>}
          {isClient && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href="/freelance/projects/new" className="btn btn-primary">Post a project</Link>
              <Link href="/freelance/services" className="btn btn-outline">Browse services</Link>
            </div>
          )}
          {isClient && <p className="mx-auto mt-4 max-w-md text-xs">Every freelancer is a verified service member or military spouse. Pay only through LanceNest, and contact details open once a job is booked.</p>}
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/freelance/projects/${p.id}`} className="card block p-5 transition-colors hover:border-brass">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="font-serif text-xl text-navy">{p.title}</p>
                  <p className="font-medium">{budget(p)}</p>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {p.company?.name ?? 'Private client'}{p.company?.is_verified && <span className="ml-1 text-olive">✓ verified company</span>} · {(p as unknown as { work_location?: string }).work_location ?? 'Remote'} · {p.category ?? 'General'} · {timeAgo(p.created_at)}{mine && ` · ${p.status.replace('_', ' ')}`}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-ink/80">{p.description}</p>
                {p.clearance_required !== 'none' && <span className="mt-2 inline-block rounded-full border border-brass/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-brass-dark">{CLEARANCE_LABEL[p.clearance_required]} required</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const contractList = (contracts ?? []).length > 0 && (
    <section className="mb-8">
      <p className="eyebrow">Your contracts</p>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {(contracts ?? []).map((k) => (
          <li key={k.id as string}><Link href={`/freelance/contracts/${k.id}`} className="card flex items-center justify-between p-4 hover:border-brass">
            <span className="font-medium text-navy">{k.title as string}</span><span className="text-xs capitalize text-muted">{k.status as string}</span>
          </Link></li>
        ))}
      </ul>
    </section>
  );

  // Service members: two ways to get work, side by side. Find projects clients posted, or offer services they can book.
  if (isVet) {
    return (
      <>
        <section className="bg-navy-deep text-ivory">
          <div className="container-page pt-10">
            <p className="eyebrow text-brass">LanceNest Freelance</p>
            <h1 className="mt-2 font-serif text-4xl font-medium text-ivory sm:text-5xl">Freelance work for verified service members</h1>
            <p className="mt-2 max-w-2xl text-cream/80">Two ways to get work: answer projects clients post, or list what you do so clients book you. Mechanic work, coaching, the trades, web design, cleared and federal projects{FREELANCE_PAYMENTS_ENABLED ? ', with payments protected until work is approved.' : '. Protected milestone payments are coming soon.'}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <a href="#projects" className="rounded-2xl border border-cream/25 bg-white/5 p-5 transition-colors hover:border-brass">
                <p className="font-serif text-2xl text-ivory">Find freelance work</p>
                <p className="mt-1 text-sm text-cream/80">Clients and verified companies post projects. Browse them and send a proposal{plan === 'free' ? ` (${FREE_PROPOSALS_PER_MONTH} free a month)` : ''}.</p>
                <span className="mt-3 inline-block text-sm font-semibold text-brass">Browse projects ↓</span>
              </a>
              <Link href="/freelance/services/mine" className="rounded-2xl border border-cream/25 bg-white/5 p-5 transition-colors hover:border-brass">
                <p className="font-serif text-2xl text-ivory">Offer your services</p>
                <p className="mt-1 text-sm text-cream/80">List what you do, from diesel repair to web design, with your price. Clients find you and book you directly.</p>
                <span className="mt-3 inline-block text-sm font-semibold text-brass">List a service →</span>
              </Link>
            </div>
            <div className="mt-8"><FreelanceTabs active="find" dark /></div>
          </div>
        </section>

        <div className="container-page py-8">
          <section id="projects" className="scroll-mt-24">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-serif text-3xl text-navy">Find freelance work</h2>
                <p className="mt-1 text-sm text-muted">Open projects from clients and verified companies. Send a proposal with your price and timeline.</p>
              </div>
              {proposalsLine}
            </div>
            {searchForm}
            {projectList}
          </section>

          <div className="mt-10">{contractList}</div>

          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <Link href="/freelance/services/mine" className="card p-5 transition-colors hover:border-brass">
              <p className="eyebrow">Rather have clients come to you?</p>
              <p className="mt-2 font-serif text-2xl text-navy">Offer a service</p>
              <p className="text-xs text-muted">Diesel repair, personal training, HVAC, photography, grant writing: list it once, on-site or remote. <span className="text-navy underline">List a service →</span></p>
            </Link>
            {FREELANCE_PAYMENTS_ENABLED ? (
              <div className="card p-5"><p className="eyebrow">Protected payments</p><p className="mt-2 font-serif text-2xl text-navy">Funded before you start</p><p className="text-xs text-muted">Clients fund each milestone up front. It’s released to you when the work is approved. <Link href="/payments-protection" className="text-navy underline">How it works →</Link></p></div>
            ) : (
              <div className="card p-5"><p className="eyebrow">Protected payments</p><p className="mt-2 font-serif text-2xl text-navy">Coming soon</p><p className="text-xs text-muted">Milestone payments on LanceNest open soon. For now, agree on payment terms directly with your client. <Link href="/payments-protection" className="text-navy underline">How it will work →</Link></p></div>
            )}
            {FREELANCE_PAYMENTS_ENABLED ? (
              <div className="card p-5"><p className="eyebrow">Payouts</p><p className="mt-2 font-serif text-2xl text-navy">{fp?.payouts_enabled ? 'Ready ✓' : 'Not set up'}</p>{!fp?.payouts_enabled && <Link href="/freelance/profile#payouts" className="text-xs text-navy underline">Set up payouts →</Link>}</div>
            ) : (
              <div className="card p-5"><p className="eyebrow">When you’re hired</p><p className="mt-2 font-serif text-2xl text-navy">You keep 100%</p><p className="text-xs text-muted">Clients pay LanceNest a small booking fee when they hire you. Share contact details once you’re booked.</p></div>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page flex flex-col gap-4 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow text-brass">LanceNest Freelance</p>
            <h1 className="mt-2 font-serif text-4xl font-medium text-ivory sm:text-5xl">Hire verified service members</h1>
            <p className="mt-2 max-w-2xl text-cream/80">Every freelancer here is a verified service member, veteran or military spouse. Mechanic work, coaching, the trades, web design, cleared and federal projects{FREELANCE_PAYMENTS_ENABLED ? ' — with payments protected until work is approved.' : '. Protected milestone payments are coming soon.'}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/freelance/services" className="btn btn-brass">Browse services</Link>
            <Link href="/freelance/projects/new" className="btn border border-cream/40 text-cream hover:border-brass">Post a project</Link>
          </div>
        </div>
      </section>

      <div className="container-page py-8">
        {contractList}
        {searchForm}
        {projectList}
      </div>
    </>
  );
}
