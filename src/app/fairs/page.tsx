import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionProfile, requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CANONICAL_ORIGIN } from '@/lib/seo';
import { baseBySlug } from '@/lib/bases';
import { fairPlace, fairWhen, formatLabel } from '@/lib/fairs';

export const metadata: Metadata = {
  title: 'Career fairs for veterans: virtual and in person',
  description: 'Free virtual career fairs and in-person hiring pop-ups near military bases, where verified service members, veterans and military spouses meet verified employers.',
  alternates: { canonical: `${CANONICAL_ORIGIN}/fairs` },
};

type Fair = {
  id: string; slug: string; title: string; description: string | null; starts_at: string; ends_at: string;
  format: string; venue_name: string | null; city: string | null; state: string | null; base_slug: string | null; timezone: string;
};
const COLS = 'id, slug, title, description, starts_at, ends_at, format, venue_name, city, state, base_slug, timezone';
const FILTERS: [string, string][] = [['', 'All'], ['virtual', 'Virtual'], ['in_person', 'In person']];

/** Signed-out visitors see what's coming (date, place, and how many employers have booked) and can sign up; members see it all. */
export default async function FairsPage(props: { searchParams: Promise<{ format?: string }> }) {
  const { format } = await props.searchParams;
  const session = await getSessionProfile();
  const signedIn = !!session;
  const profile = signedIn ? (await requireVerifiedMember('/fairs')).profile : null;
  const db = signedIn ? await createClient() : createAdminClient();
  const { data } = await db.from('career_fairs').select(COLS).gte('ends_at', new Date(Date.now() - 30 * 86400000).toISOString()).order('starts_at');
  const all = ((data ?? []) as Fair[]).filter((f) => Date.parse(f.ends_at) > Date.now());
  // "In person" includes hybrid fairs; "Virtual" includes them too, since they also run online.
  const upcoming = all.filter((f) => !format || (format === 'virtual' ? f.format !== 'in_person' : f.format !== 'virtual'));
  const booths = new Map<string, number>();
  if (upcoming.length) {
    const { data: b } = await createAdminClient().from('fair_booths').select('fair_id').in('fair_id', upcoming.map((f) => f.id));
    (b ?? []).forEach((r) => booths.set(r.fair_id as string, (booths.get(r.fair_id as string) ?? 0) + 1));
  }
  const chip = (on: boolean) => `whitespace-nowrap rounded-full border px-4 py-1.5 text-sm ${on ? 'border-navy bg-navy text-ivory' : 'border-line bg-ivory text-ink hover:border-brass'}`;
  return (
    <div className="container-page max-w-4xl space-y-6 py-10">
      <div><h1 className="font-serif text-4xl font-medium">Career fairs</h1>
        <p className="mt-1 text-muted">{profile?.role === 'employer'
          ? 'Book a booth to meet verified service members live, online or at in-person pop-ups near bases, with the attendee list included.'
          : 'Meet verified employers online from anywhere, or in person at hiring pop-ups near bases. Free for every verified member.'}</p></div>
      {!signedIn && (
        <div className="card flex flex-col gap-3 border-brass/50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink/85">Attending is free for verified service members, veterans and military spouses. Employers book a virtual booth for $499, or ask us about a table at an in-person pop-up.</p>
          <div className="flex shrink-0 gap-2"><Link href="/signup?role=veteran" className="btn btn-primary">Join free to attend</Link><Link href="/signup?role=employer" className="btn btn-outline">Book a booth</Link></div>
        </div>
      )}
      <div className="flex gap-2">{FILTERS.map(([v, l]) => <Link key={l} href={v ? `/fairs?format=${v}` : '/fairs'} className={chip((format ?? '') === v)}>{l}</Link>)}</div>
      {upcoming.length === 0 ? <p className="card p-8 text-center text-muted">No fairs scheduled right now. New fairs are announced here and by email.</p> : upcoming.map((f) => {
        const base = f.base_slug ? baseBySlug(f.base_slug) : null;
        const inner = (
          <>
            <p className="text-xs uppercase tracking-[0.12em] text-brass-dark">
              {Date.parse(f.starts_at) <= Date.now() ? 'Live now' : fairWhen(f.starts_at, f.timezone)} · {formatLabel(f.format)}
            </p>
            <p className="mt-1 font-serif text-2xl text-navy">{f.title}</p>
            {f.format !== 'virtual' && <p className="mt-1 text-sm text-ink">{fairPlace(f)}{base ? ` · near ${base.name}` : ''}</p>}
            {f.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{f.description}</p>}
            {(booths.get(f.id) ?? 0) > 0 && <p className="mt-2 text-xs font-semibold text-olive">{booths.get(f.id)} verified employer{booths.get(f.id) === 1 ? '' : 's'} booked</p>}
          </>
        );
        return <Link key={f.id} href={signedIn ? `/fairs/${f.slug}` : '/signup?role=veteran'} className="card block p-6 hover:border-brass">{inner}</Link>;
      })}
    </div>
  );
}
