import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionProfile, requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CANONICAL_ORIGIN } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Virtual career fairs for veterans',
  description: 'Free virtual career fairs where verified service members, veterans and military spouses meet verified employers live.',
  alternates: { canonical: `${CANONICAL_ORIGIN}/fairs` },
};
const when = (d: string) => new Date(d).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/New_York' }) + ' ET';

type Fair = { id: string; slug: string; title: string; description: string | null; starts_at: string; ends_at: string };

/** Signed-out visitors see what's coming (date and how many employers have booked) and can sign up; members see it all. */
export default async function FairsPage() {
  const session = await getSessionProfile();
  const signedIn = !!session;
  const profile = signedIn ? (await requireVerifiedMember('/fairs')).profile : null;
  const db = signedIn ? await createClient() : createAdminClient();
  const { data } = await db.from('career_fairs').select('id, slug, title, description, starts_at, ends_at').gte('ends_at', new Date(Date.now() - 30 * 86400000).toISOString()).order('starts_at');
  const upcoming = ((data ?? []) as Fair[]).filter((f) => Date.parse(f.ends_at) > Date.now());
  const booths = new Map<string, number>();
  if (upcoming.length) {
    const { data: b } = await createAdminClient().from('fair_booths').select('fair_id').in('fair_id', upcoming.map((f) => f.id));
    (b ?? []).forEach((r) => booths.set(r.fair_id as string, (booths.get(r.fair_id as string) ?? 0) + 1));
  }
  return (
    <div className="container-page max-w-4xl space-y-6 py-10">
      <div><h1 className="font-serif text-4xl font-medium">Virtual career fairs</h1>
        <p className="mt-1 text-muted">{profile?.role === 'employer' ? 'Book a booth to meet verified service members live, with the attendee list included.' : 'Meet verified employers live, from anywhere. Free for every verified member.'}</p></div>
      {!signedIn && (
        <div className="card flex flex-col gap-3 border-brass/50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink/85">Attending is free for verified service members, veterans and military spouses. Employers book a booth for $499.</p>
          <div className="flex shrink-0 gap-2"><Link href="/signup?role=veteran" className="btn btn-primary">Join free to attend</Link><Link href="/signup?role=employer" className="btn btn-outline">Book a booth</Link></div>
        </div>
      )}
      {upcoming.length === 0 ? <p className="card p-8 text-center text-muted">No fairs scheduled right now. New fairs are announced here and by email.</p> : upcoming.map((f) => {
        const inner = (
          <>
            <p className="text-xs uppercase tracking-[0.12em] text-brass-dark">{Date.parse(f.starts_at) <= Date.now() ? 'Live now' : when(f.starts_at)}</p>
            <p className="mt-1 font-serif text-2xl text-navy">{f.title}</p>
            {f.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{f.description}</p>}
            {(booths.get(f.id) ?? 0) > 0 && <p className="mt-2 text-xs font-semibold text-olive">{booths.get(f.id)} verified employer{booths.get(f.id) === 1 ? '' : 's'} booked</p>}
          </>
        );
        return signedIn
          ? <Link key={f.id} href={`/fairs/${f.slug}`} className="card block p-6 hover:border-brass">{inner}</Link>
          : <Link key={f.id} href={`/signup?role=veteran`} className="card block p-6 hover:border-brass">{inner}</Link>;
      })}
    </div>
  );
}
