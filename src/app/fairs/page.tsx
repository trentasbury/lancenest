import type { Metadata } from 'next';
import Link from 'next/link';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Virtual career fairs' };
const when = (d: string) => new Date(d).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });

export default async function FairsPage() {
  const { profile } = await requireVerifiedMember('/fairs');
  const { data } = await createClient().from('career_fairs').select('id, slug, title, description, starts_at, ends_at').gte('ends_at', new Date(Date.now() - 30 * 86400000).toISOString()).order('starts_at');
  const upcoming = (data ?? []).filter((f) => Date.parse(f.ends_at as string) > Date.now());
  return (
    <div className="container-page max-w-4xl space-y-6 py-10">
      <div><h1 className="font-serif text-4xl font-medium">Virtual career fairs</h1>
        <p className="mt-1 text-muted">{profile.role === 'employer' ? 'Book a booth to meet verified service members live — with the attendee list included.' : 'Meet verified employers live, from anywhere. Free for every verified member.'}</p></div>
      {upcoming.length === 0 ? <p className="card p-8 text-center text-muted">No fairs scheduled right now — new fairs are announced here and by email.</p> : upcoming.map((f) => (
        <Link key={f.id as string} href={`/fairs/${f.slug}`} className="card block p-6 hover:border-brass">
          <p className="text-xs uppercase tracking-[0.12em] text-brass-dark">{Date.parse(f.starts_at as string) <= Date.now() ? 'Live now' : when(f.starts_at as string)}</p>
          <p className="mt-1 font-serif text-2xl text-navy">{f.title as string}</p>
          {f.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{f.description as string}</p>}
        </Link>
      ))}
    </div>
  );
}
