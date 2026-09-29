import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getMyCompany, PAID } from '@/lib/employer';
import SubmitButton from '@/components/SubmitButton';
import VerifiedMark from '@/components/VerifiedMark';
import { startConversation } from '@/app/messages/actions';
import { leaveFair, registerFair, updateBooth } from '../actions';

export const metadata: Metadata = { title: 'Career fair' };
type Booth = { id: string; pitch: string | null; video_url: string | null; company: { id: string; name: string; slug: string; logo_url: string | null; owner_id: string } | null };

export default async function FairPage({ params, searchParams }: { params: { slug: string }; searchParams: { saved?: string } }) {
  const { user, profile } = await requireVerifiedMember(`/fairs/${params.slug}`);
  const supabase = createClient();
  const { data: f } = await supabase.from('career_fairs').select('*').eq('slug', params.slug).maybeSingle();
  if (!f) notFound();
  const now = Date.now(), live = Date.parse(f.starts_at as string) <= now && now < Date.parse(f.ends_at as string), ended = now >= Date.parse(f.ends_at as string);
  const [{ data: boothRows }, { data: mine }, { count: attendees }] = await Promise.all([
    supabase.from('fair_booths').select('id, pitch, video_url, company:companies(id, name, slug, logo_url, owner_id)').eq('fair_id', f.id),
    supabase.from('fair_registrations').select('profile_id').eq('fair_id', f.id).eq('profile_id', user.id).maybeSingle(),
    supabase.from('fair_registrations').select('profile_id', { count: 'exact', head: true }).eq('fair_id', f.id),
  ]);
  const booths = (boothRows ?? []) as unknown as Booth[];
  const company = profile.role === 'employer' ? await getMyCompany(user.id) : null;
  const myBooth = company ? booths.find((b) => b.company?.id === company.id) : undefined;
  const { data: regs } = myBooth ? await supabase.from('fair_registrations').select('profile:profiles(id, full_name, username, headline, verified)').eq('fair_id', f.id) : { data: [] };
  const price = company && PAID.includes(company.plan) ? 399 : 499;
  return (
    <div className="container-page grid max-w-6xl gap-8 py-10 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-5">
        <Link href="/fairs" className="text-sm text-muted hover:text-navy">← Career fairs</Link>
        <p className="text-xs uppercase tracking-[0.12em] text-brass-dark">{live ? '● Live now' : ended ? 'Ended' : new Date(f.starts_at as string).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</p>
        <h1 className="font-serif text-4xl font-medium">{f.title as string}</h1>
        {f.description && <p className="whitespace-pre-line text-ink/85">{f.description as string}</p>}
        <p className="text-sm text-muted">{booths.length} employer booth{booths.length === 1 ? '' : 's'} · {attendees ?? 0} registered</p>
        <section className="space-y-3">
          <h2 className="eyebrow">Employers at this fair</h2>
          {booths.length === 0 && <p className="card p-6 text-sm text-muted">Booths are being booked — check back soon.</p>}
          {booths.map((b) => (
            <div key={b.id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
              <div className="flex-1">
                <p className="font-serif text-xl text-navy"><Link href={`/companies/${b.company?.slug}`} className="hover:underline">{b.company?.name}</Link><VerifiedMark /></p>
                {b.pitch && <p className="mt-1 text-sm text-ink/85">{b.pitch}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {live && b.video_url && <a href={b.video_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary py-2 text-sm">Join live ↗</a>}
                <Link href={`/companies/${b.company?.slug}`} className="btn btn-outline py-2 text-sm">Open jobs</Link>
                {profile.role !== 'employer' && b.company && <form action={startConversation.bind(null, b.company.owner_id)}><SubmitButton className="btn btn-ghost border border-line py-2 text-sm" pendingText="…">Message</SubmitButton></form>}
              </div>
            </div>
          ))}
        </section>
      </div>
      <aside className="space-y-4">
        {profile.role !== 'employer' && !ended && (
          <div className="card p-6">
            {mine ? <><p className="text-sm text-olive">✓ You’re registered. Employers with a booth can see your profile and reach out.</p><form action={leaveFair.bind(null, f.id as string, params.slug)} className="mt-3"><button className="text-xs text-muted hover:text-signal">Cancel registration</button></form></>
              : <><p className="text-sm">Register free — employers at the fair will see your profile.</p><form action={registerFair.bind(null, f.id as string, params.slug)} className="mt-3"><SubmitButton className="btn btn-primary w-full" pendingText="…">Register for this fair</SubmitButton></form></>}
          </div>
        )}
        {company && !myBooth && !ended && Date.parse(f.starts_at as string) > now && (
          <form action="/api/billing/checkout" method="post" className="card space-y-3 p-6">
            <p className="eyebrow">Book a booth · ${price}</p>
            <p className="text-xs text-muted">Featured booth, your open jobs, a live video link, and the full attendee list. {price === 399 ? 'Plan member price.' : 'Professional and Federal plans pay $399.'}</p>
            <input type="hidden" name="product" value="fair_booth" /><input type="hidden" name="fair_id" value={f.id as string} />
            <textarea name="pitch" rows={3} maxLength={450} placeholder="Who you’re hiring (e.g. 20 cleared field technicians, Virginia)" className="field text-sm" />
            <input name="video_url" placeholder="https:// Zoom, Teams, or Meet link (optional)" className="field text-sm" />
            <button className="btn btn-primary w-full" disabled={!company.is_verified}>Book and pay ${price}</button>
          </form>
        )}
        {myBooth && (
          <div className="card space-y-3 p-6">
            <p className="eyebrow">Your booth</p>
            {searchParams.saved && <p className="text-sm text-olive">Saved.</p>}
            <form action={updateBooth.bind(null, myBooth.id, params.slug)} className="space-y-2">
              <textarea name="pitch" rows={3} maxLength={1000} defaultValue={myBooth.pitch ?? ''} className="field text-sm" />
              <input name="video_url" defaultValue={myBooth.video_url ?? ''} placeholder="https:// video link" className="field text-sm" />
              <SubmitButton className="btn btn-outline w-full" pendingText="Saving…">Save booth</SubmitButton>
            </form>
            <p className="eyebrow pt-2">Registered attendees · {(regs ?? []).length}</p>
            <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
              {((regs ?? []) as unknown as { profile: { id: string; full_name: string; username: string | null; headline: string | null; verified: boolean } | null }[]).map((r) => r.profile && (
                <li key={r.profile.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0"><span className="block truncate">{r.profile.username ? <Link href={`/veterans/${r.profile.username}`} className="text-navy hover:underline">{r.profile.full_name}</Link> : r.profile.full_name}{r.profile.verified && <VerifiedMark />}</span><span className="block truncate text-xs text-muted">{r.profile.headline}</span></span>
                  <form action={startConversation.bind(null, r.profile.id)}><button className="text-xs text-navy underline">Message</button></form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
