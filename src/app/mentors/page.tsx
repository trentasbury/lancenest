import type { Metadata } from 'next';
import Link from 'next/link';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { MENTOR_FIELDS } from '@/lib/mentors';
import Avatar from '@/components/network/Avatar';
import VerifiedMark from '@/components/VerifiedMark';
import SubmitButton from '@/components/SubmitButton';
import { startConversation } from '@/app/messages/actions';
import { saveMentorProfile } from './actions';

export const metadata: Metadata = { title: 'Mentors' };
type Mentor = { profile_id: string; fields: string[]; bio: string | null; profile: { full_name: string; username: string | null; headline: string | null; avatar_url: string | null; verified: boolean } | null };

export default async function MentorsPage({ searchParams }: { searchParams: { field?: string; saved?: string } }) {
  const { user, profile } = await requireVerifiedMember('/mentors');
  const supabase = createClient();
  const field = MENTOR_FIELDS.includes(searchParams.field ?? '') ? searchParams.field! : null;
  let q = supabase.from('mentor_profiles').select('profile_id, fields, bio, profile:profiles(full_name, username, headline, avatar_url, verified)').eq('available', true).neq('profile_id', user.id);
  if (field) q = q.contains('fields', [field]);
  const [{ data }, { data: mine }] = await Promise.all([q.order('updated_at', { ascending: false }).limit(60), supabase.from('mentor_profiles').select('fields, bio, available').eq('profile_id', user.id).maybeSingle()]);
  const mentors = (data ?? []) as unknown as Mentor[];
  return (
    <div className="container-page grid max-w-6xl gap-8 py-10 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-5">
        <div><h1 className="font-serif text-4xl font-medium">Mentors</h1><p className="mt-1 text-muted">Veterans who’ve made the move, volunteering to help the next one. Free for every verified member.</p></div>
        <div className="flex flex-wrap gap-2">
          <Link href="/mentors" className={`rounded-full border px-3 py-1 text-sm ${!field ? 'border-navy bg-navy text-ivory' : 'border-line'}`}>All</Link>
          {MENTOR_FIELDS.map((f) => <Link key={f} href={`/mentors?field=${encodeURIComponent(f)}`} className={`rounded-full border px-3 py-1 text-sm ${field === f ? 'border-navy bg-navy text-ivory' : 'border-line hover:border-brass'}`}>{f}</Link>)}
        </div>
        {mentors.length === 0 ? <p className="card p-8 text-center text-muted">No mentors in this area yet — be the first.</p> : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {mentors.map((m) => (
              <li key={m.profile_id} className="card flex flex-col gap-3 p-5">
                <div className="flex items-center gap-3">
                  <Avatar name={m.profile?.full_name} src={m.profile?.avatar_url} />
                  <div className="min-w-0"><p className="truncate font-medium">{m.profile?.username ? <Link href={`/veterans/${m.profile.username}`} className="hover:underline">{m.profile.full_name}</Link> : m.profile?.full_name}{m.profile?.verified && <VerifiedMark />}</p>
                    <p className="truncate text-xs text-muted">{m.profile?.headline}</p></div>
                </div>
                <div className="flex flex-wrap gap-1">{m.fields.map((f) => <span key={f} className="pill text-[11px]">{f}</span>)}</div>
                {m.bio && <p className="text-sm text-ink/85">{m.bio}</p>}
                <form action={startConversation.bind(null, m.profile_id)} className="mt-auto">
                  <input type="hidden" name="draft" value={`Hi ${m.profile?.full_name?.split(' ')[0] ?? 'there'} — I saw you mentor on LanceNest${field ? ` in ${field.toLowerCase()}` : ''}. I’d really value your advice on `} />
                  <SubmitButton className="btn btn-primary w-full py-2 text-sm" pendingText="…">Request mentorship</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
      {['veteran', 'admin'].includes(profile.role) && (
        <aside>
          <form action={saveMentorProfile} className="card sticky top-24 space-y-3 p-5">
            <p className="eyebrow">{mine ? 'Your mentor profile' : 'Become a mentor'}</p>
            {searchParams.saved && <p className="text-sm text-olive">Saved.</p>}
            <p className="text-xs text-muted">Pick what you can help with. Requests arrive as messages — reply when you have time.</p>
            <div className="grid gap-1.5">{MENTOR_FIELDS.map((f) => <label key={f} className="flex items-center gap-2 text-sm"><input type="checkbox" name="fields" value={f} defaultChecked={((mine?.fields as string[] | undefined) ?? []).includes(f)} className="accent-navy" />{f}</label>)}</div>
            <textarea name="bio" rows={3} maxLength={1000} defaultValue={(mine?.bio as string) ?? ''} placeholder="Your path and how you can help" className="field text-sm" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="available" defaultChecked={mine ? !!mine.available : true} className="accent-navy" />Available for new mentees</label>
            <SubmitButton className="btn btn-primary w-full" pendingText="Saving…">{mine ? 'Save' : 'Become a mentor'}</SubmitButton>
          </form>
        </aside>
      )}
    </div>
  );
}
