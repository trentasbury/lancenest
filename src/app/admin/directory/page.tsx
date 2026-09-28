import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { sanitizeSearch } from '@/lib/format';

export const metadata: Metadata = { title: 'Directory', robots: { index: false } };
const TABS = [['veterans', 'Service members'], ['employers', 'Employers'], ['companies', 'Companies'], ['jobs', 'Open jobs']] as const;
const PAGE = 50;
const d = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '—');

export default async function DirectoryPage({ searchParams }: { searchParams: { tab?: string; q?: string; page?: string } }) {
  await requireAdmin('/admin/directory');
  const admin = createAdminClient();
  const tab = TABS.some(([t]) => t === searchParams.tab) ? searchParams.tab! : 'veterans';
  const q = sanitizeSearch(searchParams.q ?? '');
  const page = Math.max(1, Number(searchParams.page) || 1);
  const from = (page - 1) * PAGE, to = from + PAGE - 1;
  let rows: { key: string; cells: (string | JSX.Element)[]; href: string }[] = [];
  let head: string[] = [];
  let total = 0;

  if (tab === 'veterans' || tab === 'employers') {
    let query = admin.from('profiles').select('id, full_name, username, headline, verified, created_at, last_active_at, banned, veteran:veteran_profiles(plan, verification_status)', { count: 'exact' })
      .eq('role', tab === 'veterans' ? 'veteran' : 'employer');
    if (q) query = query.or(`full_name.ilike.%${q}%,headline.ilike.%${q}%`);
    const { data, count } = await query.order('created_at', { ascending: false }).range(from, to);
    total = count ?? 0;
    head = tab === 'veterans' ? ['Name', 'Verification', 'Plan', 'Joined', 'Last active'] : ['Name', 'Title', 'Joined', 'Last active'];
    rows = ((data ?? []) as unknown as { id: string; full_name: string; headline: string | null; verified: boolean; created_at: string; last_active_at: string | null; banned: boolean; veteran: { plan: string; verification_status: string } | { plan: string; verification_status: string }[] | null }[]).map((m) => {
      const v = Array.isArray(m.veteran) ? m.veteran[0] : m.veteran;
      return { key: m.id, href: `/admin/members?id=${m.id}`, cells: tab === 'veterans'
        ? [<span key="n">{m.full_name}{m.banned && <span className="ml-2 text-xs text-signal">removed</span>}</span>, <span key="v" className={v?.verification_status === 'verified' ? 'text-olive' : 'text-muted'}>{v?.verification_status?.replace('_', ' ') ?? '—'}</span>, (v?.plan ?? 'free').replace('_', ' '), d(m.created_at), d(m.last_active_at)]
        : [m.full_name, m.headline ?? '—', d(m.created_at), d(m.last_active_at)] };
    });
  } else if (tab === 'companies') {
    let query = admin.from('companies').select('id, name, slug, verification_status, plan, created_at, public_safety_status, training_listing_active', { count: 'exact' });
    if (q) query = query.ilike('name', `%${q}%`);
    const { data, count } = await query.order('created_at', { ascending: false }).range(from, to);
    total = count ?? 0;
    head = ['Company', 'Verification', 'Plan', 'Extras', 'Joined'];
    rows = (data ?? []).map((c) => ({ key: c.id as string, href: `/companies/${c.slug}`, cells: [c.name as string,
      <span key="v" className={c.verification_status === 'verified' ? 'text-olive' : c.verification_status === 'pending' ? 'text-brass-dark' : 'text-muted'}>{c.verification_status as string}</span>,
      c.plan as string, [c.public_safety_status === 'approved' && 'Public Safety', c.training_listing_active && 'Training'].filter(Boolean).join(', ') || '—', d(c.created_at as string)] }));
  } else {
    let query = admin.from('jobs').select('id, slug, title, location, posted_at, employment_type, company:companies(name)', { count: 'exact' }).eq('status', 'open');
    if (q) query = query.ilike('title', `%${q}%`);
    const { data, count } = await query.order('posted_at', { ascending: false }).range(from, to);
    total = count ?? 0;
    const ids = (data ?? []).map((j) => j.id as string);
    const { data: apps } = ids.length ? await admin.from('applications').select('job_id').in('job_id', ids).eq('source', 'lancenest') : { data: [] };
    const appCount = new Map<string, number>(); (apps ?? []).forEach((a) => appCount.set(a.job_id as string, (appCount.get(a.job_id as string) ?? 0) + 1));
    head = ['Job', 'Company', 'Location', 'Type', 'Applicants', 'Posted'];
    rows = ((data ?? []) as unknown as { id: string; slug: string; title: string; location: string | null; posted_at: string; employment_type: string; company: { name: string } | null }[]).map((j) => ({
      key: j.id, href: `/jobs/${j.slug}`, cells: [j.title, j.company?.name ?? '—', j.location ?? '—', j.employment_type.replace('_', ' '), String(appCount.get(j.id) ?? 0), d(j.posted_at)] }));
  }
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (p: number) => `/admin/directory?tab=${tab}${q ? `&q=${encodeURIComponent(q)}` : ''}&page=${p}`;

  return (
    <>
      <section className="bg-navy-deep text-ivory"><div className="container-page py-10">
        <Link href="/admin" className="text-sm text-cream/70 hover:text-brass">← Admin</Link>
        <h1 className="mt-3 font-serif text-4xl font-medium text-ivory">Directory</h1>
        <div className="mt-5 flex flex-wrap gap-2">{TABS.map(([t, l]) => <Link key={t} href={`/admin/directory?tab=${t}`} className={`rounded-full border px-4 py-1.5 text-sm ${tab === t ? 'border-brass bg-brass text-navy' : 'border-cream/30 text-cream hover:border-brass'}`}>{l}</Link>)}</div>
      </div></section>
      <div className="container-page space-y-4 py-8">
        <form method="get" className="flex gap-2"><input type="hidden" name="tab" value={tab} /><input name="q" defaultValue={searchParams.q} placeholder="Search by name or title" className="field" /><button className="btn btn-primary">Search</button></form>
        <p className="text-sm text-muted">{total.toLocaleString()} total{total > PAGE ? ` · page ${page} of ${pages}` : ''} · click a row to open it</p>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-muted"><tr>{head.map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => <tr key={r.key} className="hover:bg-paper">{r.cells.map((c, i) => <td key={i} className="p-3">{i === 0 ? <Link href={r.href} className="font-medium text-navy hover:underline">{c}</Link> : c}</td>)}</tr>)}
              {rows.length === 0 && <tr><td colSpan={head.length} className="p-8 text-center text-muted">Nothing here yet.</td></tr>}
            </tbody>
          </table>
        </div>
        {pages > 1 && <div className="flex gap-2">{page > 1 && <Link href={link(page - 1)} className="btn btn-outline">← Previous</Link>}{page < pages && <Link href={link(page + 1)} className="btn btn-outline">Next →</Link>}</div>}
      </div>
    </>
  );
}
