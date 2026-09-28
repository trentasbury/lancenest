import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PAID, getMyCompany } from '@/lib/employer';
import Upsell from '@/components/employer/Upsell';
import VerifiedMark from '@/components/VerifiedMark';
import { removeFromPool } from './actions';

export const metadata: Metadata = { title: 'Talent pools' };
type Item = { id: string; list_name: string; note: string | null; created_at: string; profile: { full_name: string; username: string | null; headline: string | null; verified: boolean } | null };

export default async function TalentPage() {
  const { user } = await requireRole(['employer'], '/employer/talent');
  const company = await getMyCompany(user.id);
  if (!company) redirect('/employer/dashboard');
  if (!PAID.includes(company.plan)) {
    return <div className="container-page max-w-3xl py-12"><h1 className="mb-6 font-serif text-4xl font-medium">Talent pools</h1>
      <Upsell title="Keep your best candidates organized." body="Save verified service members into lists like “Q1 cyber hires,” with private notes your team can revisit anytime." /></div>;
  }
  const { data } = await createClient().from('talent_pool_items').select('id, list_name, note, created_at, profile:profiles!talent_pool_items_profile_id_fkey(full_name, username, headline, verified)').eq('company_id', company.id).order('created_at', { ascending: false });
  const items = (data ?? []) as unknown as Item[];
  const lists = Array.from(new Set(items.map((i) => i.list_name)));
  return (
    <div className="container-page max-w-4xl space-y-6 py-10">
      <Link href="/employer/dashboard" className="text-sm text-muted hover:text-navy">← Employer dashboard</Link>
      <h1 className="font-serif text-4xl font-medium">Talent pools</h1>
      <p className="text-muted">Save candidates from search, applicants, or any profile. Notes are private to your company.</p>
      {items.length === 0 && <p className="card p-8 text-center text-muted">No saved candidates yet. Use “Save to talent pool” on a candidate’s profile or in search.</p>}
      {lists.map((l) => (
        <section key={l} className="card p-6">
          <p className="eyebrow">{l} · {items.filter((i) => i.list_name === l).length}</p>
          <ul className="mt-3 divide-y divide-line">
            {items.filter((i) => i.list_name === l).map((i) => (
              <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{i.profile?.username ? <Link href={`/veterans/${i.profile.username}`} className="hover:underline">{i.profile.full_name}</Link> : i.profile?.full_name}{i.profile?.verified && <VerifiedMark />}</p>
                  <p className="text-xs text-muted">{i.profile?.headline}</p>
                  {i.note && <p className="mt-1 text-sm text-ink/80">{i.note}</p>}
                </div>
                <form action={removeFromPool.bind(null, i.id)}><button className="text-xs text-muted hover:text-signal">Remove</button></form>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
