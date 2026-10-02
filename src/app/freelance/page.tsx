import type { Metadata } from 'next';
import Link from 'next/link';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CATEGORIES, FREE_PROPOSALS_PER_MONTH, keepPercent, proposalsUsedThisMonth } from '@/lib/freelance';
import { CLEARANCE_LABEL } from '@/lib/employer';
import { sanitizeSearch } from '@/lib/format';
import { timeAgo } from '@/lib/network';

export const metadata: Metadata = { title: 'Freelance' };

type Project = { id: string; title: string; description: string; category: string | null; budget_type: string; budget_min: number | null; budget_max: number | null; clearance_required: string; status: string; created_at: string; company: { name: string; is_verified: boolean } | null };
const budget = (p: Project) => (p.budget_min || p.budget_max) ? `$${(p.budget_min ?? p.budget_max)!.toLocaleString()}${p.budget_max && p.budget_min && p.budget_max !== p.budget_min ? `–$${p.budget_max.toLocaleString()}` : ''}${p.budget_type === 'hourly' ? '/hr' : ''}` : 'Budget open';

export default async function FreelancePage({ searchParams }: { searchParams: { q?: string; category?: string; cleared?: string; mine?: string } }) {
  const { user, profile } = await requireVerifiedMember('/freelance');
  const supabase = createClient();
  const isVet = profile.role === 'veteran';
  const [{ data: fp }, { data: vet }] = isVet
    ? await Promise.all([
        supabase.from('freelancer_profiles').select('title, payouts_enabled').eq('profile_id', user.id).maybeSingle(),
        supabase.from('veteran_profiles').select('plan').eq('profile_id', user.id).maybeSingle(),
      ])
    : [{ data: null }, { data: null }];
  const used = isVet ? await proposalsUsedThisMonth(user.id) : 0;
  const plan = (vet?.plan as string) ?? 'free';
  const { data: contracts } = await supabase.from('contracts').select('id, title, status').or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`).order('created_at', { ascending: false }).limit(10);

  let q = supabase.from('freelance_projects').select('id, title, description, category, work_location, budget_type, budget_min, budget_max, clearance_required, status, created_at, company:companies(name, is_verified)');
  const mine = !isVet && searchParams.mine !== '0';
  if (mine) q = q.eq('client_id', user.id); else q = q.eq('status', 'open');
  const kw = sanitizeSearch(searchParams.q ?? '');
  if (kw) q = q.textSearch('search', kw, { type: 'websearch', config: 'english' });
  if (searchParams.category && CATEGORIES.includes(searchParams.category)) q = q.eq('category', searchParams.category);
  if (searchParams.cleared) q = q.neq('clearance_required', 'none');
  const { data } = await q.order('created_at', { ascending: false }).limit(50);
  const projects = (data ?? []) as unknown as Project[];

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page flex flex-col gap-4 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow text-brass">LanceNest Freelance</p>
            <h1 className="mt-2 font-serif text-4xl font-medium text-ivory sm:text-5xl">{isVet ? 'Contract work for verified service members' : 'Hire verified service members'}</h1>
            <p className="mt-2 max-w-2xl text-cream/80">Every freelancer here is a verified service member. Cleared work, federal projects, and real skills — with payments protected until work is approved.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {!isVet && <Link href="/freelance/services" className="btn btn-brass">Browse services</Link>}
            {!isVet && <Link href="/freelance/projects/new" className="btn border border-cream/40 text-cream hover:border-brass">Post a project</Link>}
            {isVet && <Link href="/freelance/services/mine" className="btn btn-brass">Offer a service</Link>}
            {isVet && <Link href="/freelance/profile" className="btn border border-cream/40 text-cream hover:border-brass">{fp ? 'Freelancer profile' : 'Set up payouts'}</Link>}
          </div>
        </div>
      </section>

      <div className="container-page py-8">
        {isVet && (
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="card p-5"><p className="eyebrow">Proposals this month</p><p className="mt-2 font-serif text-2xl text-navy">{plan === 'free' ? `${used} of ${FREE_PROPOSALS_PER_MONTH}` : `${used} · unlimited`}</p>{plan === 'free' && <Link href="/plans" className="text-xs text-navy underline">Unlimited with Pro →</Link>}</div>
            <div className="card p-5"><p className="eyebrow">You keep</p><p className="mt-2 font-serif text-2xl text-navy">{keepPercent(plan)}% of every payment</p><p className="text-xs text-muted">Pro 90% · Pro Plus 92% · Federal 94%</p></div>
            <div className="card p-5"><p className="eyebrow">Payouts</p><p className="mt-2 font-serif text-2xl text-navy">{fp?.payouts_enabled ? 'Ready ✓' : 'Not set up'}</p>{!fp?.payouts_enabled && <Link href="/freelance/profile#payouts" className="text-xs text-navy underline">Set up payouts →</Link>}</div>
          </div>
        )}

        {(contracts ?? []).length > 0 && (
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
        )}

        <form method="get" className="card mb-6 grid gap-3 p-5 sm:grid-cols-4">
          <input name="q" defaultValue={searchParams.q} placeholder="Search projects (e.g. enterprise software, logistics, cyber)" className="field sm:col-span-2" />
          <select name="category" defaultValue={searchParams.category ?? ''} className="field"><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="cleared" value="1" defaultChecked={!!searchParams.cleared} className="accent-navy" />Cleared work only</label>
          {!isVet && <input type="hidden" name="mine" value={mine ? '1' : '0'} />}
          <div className="flex gap-2 sm:col-span-4"><button className="btn btn-primary">Search</button>
            {!isVet && <Link href={mine ? '/freelance?mine=0' : '/freelance'} className="btn btn-ghost border border-line">{mine ? 'Browse all open projects' : 'Your projects'}</Link>}
          </div>
        </form>

        <p className="eyebrow">{mine ? 'Your projects' : `${projects.length} open project${projects.length === 1 ? '' : 's'}`}</p>
        {projects.length === 0 ? (
          <div className="card mt-3 p-8 text-center text-muted">{mine ? 'You haven’t posted a project yet.' : 'No open projects match that search yet — check back soon.'}</div>
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
                    {p.company?.name}{p.company?.is_verified && <span className="ml-1 text-olive">✓ verified company</span>} · {(p as unknown as { work_location?: string }).work_location ?? 'Remote'} · {p.category ?? 'General'} · {timeAgo(p.created_at)}{mine && ` · ${p.status.replace('_', ' ')}`}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-ink/80">{p.description}</p>
                  {p.clearance_required !== 'none' && <span className="mt-2 inline-block rounded-full border border-brass/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-brass-dark">{CLEARANCE_LABEL[p.clearance_required]} required</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
