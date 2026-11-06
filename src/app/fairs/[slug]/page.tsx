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
import { safeHref } from '@/lib/safeHref';
import { createAdminClient } from '@/lib/supabase/admin';
import { baseBySlug } from '@/lib/bases';
import { fairPlace, fairWhen, formatLabel } from '@/lib/fairs';

export const metadata: Metadata = { title: 'Career fair' };
type Booth = { id: string; pitch: string | null; video_url: string | null; company: { id: string; name: string; slug: string; logo_url: string | null; owner_id: string } | null };

export default async function FairPage(
  props: { params: Promise<{ slug: string }>; searchParams: Promise<{ saved?: string; booth?: string; full?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const { user, profile } = await requireVerifiedMember(`/fairs/${params.slug}`);
  const supabase = await createClient();
  const { data: f } = await supabase.from('career_fairs').select('*').eq('slug', params.slug).maybeSingle();
  if (!f) notFound();
  const now = Date.now(), live = Date.parse(f.starts_at as string) <= now && now < Date.parse(f.ends_at as string), ended = now >= Date.parse(f.ends_at as string);
  const [{ data: boothRows }, { data: mine }, { count: attendees }] = await Promise.all([
    supabase.from('fair_booths').select('id, pitch, video_url, company:companies(id, name, slug, logo_url, owner_id)').eq('fair_id', f.id),
    supabase.from('fair_registrations').select('profile_id').eq('fair_id', f.id).eq('profile_id', user.id).maybeSingle(),
    // Members can only see their own registration, so the count comes from the server.
    createAdminClient().from('fair_registrations').select('profile_id', { count: 'exact', head: true }).eq('fair_id', f.id),
  ]);
  const inPerson = f.format !== 'virtual';
  const base = f.base_slug ? baseBySlug(f.base_slug as string) : null;
  const full = !!f.capacity && (attendees ?? 0) >= (f.capacity as number);
  const booths = (boothRows ?? []) as unknown as Booth[];
  const company = profile.role === 'employer' ? await getMyCompany(user.id) : null;
  const myBooth = company ? booths.find((b) => b.company?.id === company.id) : undefined;
  const { data: regs } = myBooth ? await supabase.from('fair_registrations').select('profile:profiles(id, full_name, username, headline, verified)').eq('fair_id', f.id) : { data: [] };
  const included = !!company && ['federal', 'enterprise'].includes(company.plan);
  const price = included ? 0 : company && PAID.includes(company.plan) ? 399 : 499;
  return (
    <div className="container-page grid max-w-6xl gap-8 py-10 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-5">
        <Link href="/fairs" className="text-sm text-muted hover:text-navy">← Career fairs</Link>
        <p className="text-xs uppercase tracking-[0.12em] text-brass-dark">{live ? '● Live now' : ended ? 'Ended' : fairWhen(f.starts_at as string, f.timezone as string)} · {formatLabel(f.format as string)}</p>
        <h1 className="font-serif text-4xl font-medium">{f.title as string}</h1>
        {inPerson && (
          <div className="card space-y-1 p-5 text-sm">
            <p className="font-semibold text-ink">{fairPlace(f as never)}</p>
            {f.address && <p className="text-muted">{f.address as string}</p>}
            {base && <p className="text-muted">Near <Link href={`/bases/${base.slug}`} className="text-navy underline">{base.name}</Link></p>}
            {f.format === 'hybrid' && <p className="text-muted">Can’t make it in person? Employers with a virtual booth also meet attendees online.</p>}
            <p className="pt-1 text-xs text-muted">If the event is on an installation, guests without a military ID need base access (usually a REAL ID-compliant ID and a visitor pass). Bring copies of your resume.</p>
          </div>
        )}
        {f.description && <p className="whitespace-pre-line text-ink/85">{f.description as string}</p>}
        <p className="text-sm text-muted">{booths.length} employer booth{booths.length === 1 ? '' : 's'} · {attendees ?? 0} registered{f.capacity ? ` of ${f.capacity} spots` : ''}</p>
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
                {live && safeHref(b.video_url) && <a href={safeHref(b.video_url)} target="_blank" rel="noopener noreferrer" className="btn btn-primary py-2 text-sm">Join live ↗</a>}
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
              : full || searchParams.full ? <p className="text-sm text-muted">This fair is full. Check back, as spots open up when people cancel.</p>
              : <><p className="text-sm">Register free. Employers at the fair will see your profile{inPerson ? ', and you’ll get the details before the day' : ''}.</p><form action={registerFair.bind(null, f.id as string, params.slug)} className="mt-3"><SubmitButton className="btn btn-primary w-full" pendingText="…">{inPerson ? 'Save my spot' : 'Register for this fair'}</SubmitButton></form></>}
          </div>
        )}
        {company && !myBooth && !ended && Date.parse(f.starts_at as string) > now && f.format === 'in_person' && (
          <div className="card space-y-3 p-6">
            <p className="eyebrow">Book a table</p>
            <p className="text-sm text-muted">Tables at in-person pop-ups are booked with our team so we can confirm space, power and base access for your recruiters.</p>
            <Link href={`/help?kind=support&subject=${encodeURIComponent(`Table at ${f.title as string}`)}`} className="btn btn-primary w-full">Ask about a table</Link>
          </div>
        )}
        {company && !myBooth && !ended && Date.parse(f.starts_at as string) > now && f.format !== 'in_person' && (
          <form action="/api/billing/checkout" method="post" className="card space-y-3 p-6">
            <p className="eyebrow">Book a {f.format === 'hybrid' ? 'virtual ' : ''}booth · {included ? 'Included with your plan' : `$${price}`}</p>
            {f.format === 'hybrid' && <p className="text-xs text-muted">For a table at the in-person event, <Link href={`/help?kind=support&subject=${encodeURIComponent(`Table at ${f.title as string}`)}`} className="underline">ask our team</Link>.</p>}
            {searchParams.booth === 'error' && <p className="text-sm text-signal">That booth couldn’t be booked. Check that the pitch follows the Code of Conduct, then try again.</p>}
            <p className="text-xs text-muted">Featured booth, your open jobs, a live video link, and the full attendee list. {included ? 'Booths are included on Federal and Enterprise.' : price === 399 ? 'Professional price. Booths are included on Federal.' : 'Professional pays $399; booths are included on Federal.'}</p>
            <input type="hidden" name="product" value="fair_booth" /><input type="hidden" name="fair_id" value={f.id as string} />
            <textarea name="pitch" rows={3} maxLength={450} placeholder="Who you’re hiring (e.g. 20 cleared field technicians, Virginia)" className="field text-sm" />
            <input name="video_url" placeholder="https:// Zoom, Teams, or Meet link (optional)" className="field text-sm" />
            <button className="btn btn-primary w-full" disabled={!company.is_verified}>{included ? 'Book my booth' : `Book and pay $${price}`}</button>
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
