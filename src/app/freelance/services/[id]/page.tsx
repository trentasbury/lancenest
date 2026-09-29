import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { DELIVERY_LABEL, PRICE_LABEL } from '@/lib/freelance';
import Avatar from '@/components/network/Avatar';
import VerifiedMark from '@/components/VerifiedMark';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { requestService } from '../actions';

export const metadata: Metadata = { title: 'Service' };
const ERR: Record<string, string> = { amount: 'Enter an amount of at least $20.', note: 'Describe what you need (at least a sentence).', payouts: 'This member hasn’t finished payout setup yet, so they can’t be hired through LanceNest yet. Message them to let them know.', save: 'That didn’t go through — please try again.' };

export default async function ServicePage({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  const { user } = await requireVerifiedMember(`/freelance/services/${params.id}`);
  const supabase = createClient();
  const { data } = await supabase.from('service_listings').select('*, provider:profiles!service_listings_profile_id_fkey(id, full_name, username, headline, avatar_url, verified)').eq('id', params.id).maybeSingle();
  if (!data) notFound();
  const s = data as unknown as { id: string; title: string; category: string; description: string; price_cents: number; price_type: string; delivery: string; service_area: string | null; profile_id: string;
    provider: { id: string; full_name: string; username: string | null; headline: string | null; avatar_url: string | null; verified: boolean } | null };
  const { data: track } = await supabase.rpc('verified_work_summary', { ids: [s.profile_id] });
  const t = ((track ?? []) as { completed: number; avg_rating: number | null }[])[0];
  const own = s.profile_id === user.id;
  return (
    <div className="container-page grid max-w-5xl gap-8 py-10 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <Link href="/freelance/services" className="text-sm text-muted hover:text-navy">← Services</Link>
        <p className="text-xs uppercase tracking-[0.12em] text-brass-dark">{s.category}</p>
        <h1 className="font-serif text-4xl font-medium">{s.title}</h1>
        <p className="text-sm text-muted">{DELIVERY_LABEL[s.delivery]}{s.service_area ? ` · ${s.service_area}` : ''}</p>
        <div className="card whitespace-pre-line p-6 text-ink/90">{s.description}</div>
        <div className="card flex items-center gap-3 p-5">
          <Avatar name={s.provider?.full_name} src={s.provider?.avatar_url} />
          <div><p className="font-medium">{s.provider?.username ? <Link href={`/veterans/${s.provider.username}`} className="hover:underline">{s.provider.full_name}</Link> : s.provider?.full_name}{s.provider?.verified && <VerifiedMark />}</p>
            <p className="text-xs text-muted">{s.provider?.headline}</p>
            <p className="text-xs text-olive">{t ? `✓ ${t.completed} verified job${t.completed === 1 ? '' : 's'}${t.avg_rating ? ` · ${t.avg_rating}★` : ''}` : 'New to LanceNest freelance'}</p></div>
        </div>
      </div>
      <aside>
        <div className="card sticky top-24 space-y-3 p-6">
          <p className="font-serif text-3xl text-navy">${(s.price_cents / 100).toLocaleString()}<span className="text-base text-muted">{PRICE_LABEL[s.price_type]}</span></p>
          {own ? <Link href="/freelance/services/mine" className="btn btn-outline w-full">Manage your services</Link> : (
            <form action={requestService.bind(null, s.id)} className="space-y-3">
              {searchParams.error && <FormMessage error={ERR[searchParams.error] ?? ERR.save} />}
              <div><label className="field-label" htmlFor="amount">Agreed amount ($)</label><input id="amount" name="amount" required inputMode="decimal" defaultValue={(s.price_cents / 100).toString()} className="field" /></div>
              <div><label className="field-label" htmlFor="note">What you need</label><textarea id="note" name="note" required rows={4} maxLength={2000} placeholder={s.delivery === 'remote' ? 'Describe the work and your timeline' : 'Describe the work, the location, and when works for you'} className="field" /></div>
              <SubmitButton className="btn btn-primary w-full" pendingText="Sending…">Hire through LanceNest</SubmitButton>
              <p className="text-xs text-muted">You’ll fund the payment next. LanceNest holds it until you approve the work — or it releases 14 days after the work is submitted. Client fee: 5% card or 3% bank, plus $9.99.</p>
            </form>
          )}
          <p className="text-xs text-muted">Providers confirm they hold any license the work requires and, if serving, have approval for off-duty employment. Check licensing for regulated trades.</p>
        </div>
      </aside>
    </div>
  );
}
