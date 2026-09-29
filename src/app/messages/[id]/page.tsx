import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { timeAgo } from '@/lib/network';
import { scamSignals } from '@/lib/scam';
import { createAdminClient } from '@/lib/supabase/admin';
import Avatar from '@/components/network/Avatar';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { respondToRequest, sendMessage } from '../actions';
import { blockUser, reportContent } from '@/app/network/actions';

export const metadata: Metadata = { title: 'Conversation' };

export default async function ThreadPage({ params, searchParams }: { params: { id: string }; searchParams: { error?: string; draft?: string } }) {
  const { user } = await requireRole(['veteran', 'employer', 'admin'], '/messages');
  const supabase = createClient();

  const { data: conv } = await supabase.from('conversations').select('status, requested_by').eq('id', params.id).maybeSingle();
  const { count: mySentCount } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', params.id).eq('sender_id', user.id);
  const mySent = mySentCount ?? 0;
  const { data: participants } = await supabase
    .from('conversation_participants')
    .select('profile_id, profile:profiles!conversation_participants_profile_id_fkey(full_name, username, role, headline)')
    .eq('conversation_id', params.id);
  // Row-level security returns nothing unless you're a participant.
  if (!participants?.some((p) => p.profile_id === user.id)) notFound();
  const other = (participants as unknown as { profile_id: string; profile: { full_name: string; username: string | null; role: string; headline: string | null } | null }[])
    .find((p) => p.profile_id !== user.id);

  const { data: employerCo } = other?.profile?.role === 'employer'
    ? ((await createAdminClient().rpc('company_for_user', { u: other.profile_id }).maybeSingle()) as { data: { name: string; is_verified: boolean } | null })
    : { data: null };

  const [{ data: messages }] = await Promise.all([
    supabase.from('messages').select('id, sender_id, body, created_at').eq('conversation_id', params.id).order('created_at', { ascending: true }).limit(300),
    supabase.from('conversation_participants').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', params.id).eq('profile_id', user.id),
  ]);

  return (
    <div className="container-page flex max-w-3xl flex-col py-8">
      <Link href="/messages" className="text-sm text-muted hover:text-navy">← Messages</Link>
      <div className="mt-4 flex items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <Avatar name={other?.profile?.full_name} />
          <div>
            <p className="font-serif text-2xl">
              {other?.profile?.role === 'veteran' && other.profile.username
                ? <Link href={`/veterans/${other.profile.username}`} className="hover:underline">{other.profile.full_name}</Link>
                : other?.profile?.full_name ?? 'Member'}
            </p>
            {other?.profile?.headline && <p className="text-xs text-muted">{other.profile.headline}</p>}
            {other?.profile?.role === 'employer' && (
              employerCo?.is_verified
                ? <p className="mt-1 text-xs font-semibold text-olive">✓ Recruiting for {employerCo.name} · verified company</p>
                : <p className="mt-1 text-xs font-semibold text-signal">⚠ This employer’s company isn’t verified</p>
            )}
          </div>
        </div>
        {other && (
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-[3px] px-2 py-1 text-lg text-muted hover:bg-cream" aria-label="Conversation options">⋯</summary>
            <div className="absolute right-0 z-20 mt-1 w-64 space-y-1 rounded-[4px] border border-line bg-ivory p-2 text-sm shadow-card">
              <form action={blockUser.bind(null, other.profile_id)}>
                <button type="submit" className="w-full rounded-[3px] px-3 py-2 text-left hover:bg-cream">Block {other.profile?.full_name?.split(' ')[0]}</button>
              </form>
              <details>
                <summary className="cursor-pointer rounded-[3px] px-3 py-2 text-signal hover:bg-signal/5">Report this member</summary>
                <form action={reportContent.bind(null, 'profile', other.profile_id)} className="space-y-2 p-2">
                  <select name="reason" required defaultValue="" className="field text-sm">
                    <option value="" disabled>Reason…</option>
                    <option value="harassment">Harassment</option><option value="spam">Spam</option><option value="fraud">Fraud</option>
                    <option value="impersonation">Impersonation</option><option value="inappropriate">Inappropriate</option><option value="sensitive_info">Shares SSN, personal info, or OPSEC-sensitive details</option><option value="other">Other</option>
                  </select>
                  <SubmitButton className="btn btn-outline w-full py-2" pendingText="Sending…">Send report</SubmitButton>
                </form>
              </details>
            </div>
          </details>
        )}
      </div>

      <ul className="flex flex-col gap-3 py-6">
        {(messages ?? []).length === 0 && <li className="py-10 text-center text-sm text-muted">Say hello — this is the start of your conversation.</li>}
        {(messages ?? []).map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-[6px] px-4 py-2.5 ${mine ? 'bg-navy text-ivory' : 'border border-line bg-ivory text-ink'}`}>
                <p className="whitespace-pre-line text-[15px] leading-relaxed">{m.body}</p>
                <p className={`mt-1 text-[11px] ${mine ? 'text-cream/60' : 'text-muted'}`}>{timeAgo(m.created_at)}</p>
                {!mine && scamSignals(m.body).length > 0 && (
                  <p className="mt-2 rounded-[3px] border border-signal/30 bg-signal/5 px-2.5 py-1.5 text-xs text-signal">
                    ⚠ Be careful — this message {scamSignals(m.body).join(', ')}. Real LanceNest employers never ask for fees, gift cards, bank details, or your SSN in chat. Use ⋯ to report.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {conv?.status === 'request' && conv.requested_by !== user.id && (
        <div className="mb-3 rounded-[4px] border border-brass bg-brass/10 p-4 text-sm">
          <p className="font-medium">{other?.profile?.full_name ?? 'This member'} sent you a message request.</p>
          <p className="mt-1 text-muted">Accept to keep talking, or decline — they won’t be able to send more. You can also block or report them from the menu.</p>
          <div className="mt-3 flex gap-2">
            <form action={respondToRequest.bind(null, params.id, 'active')}><SubmitButton className="btn btn-primary py-1.5 text-sm" pendingText="…">Accept</SubmitButton></form>
            <form action={respondToRequest.bind(null, params.id, 'declined')}><SubmitButton className="btn btn-ghost border border-line py-1.5 text-sm" pendingText="…">Decline</SubmitButton></form>
          </div>
        </div>
      )}
      {conv?.status === 'request' && conv.requested_by === user.id && (
        <p className="mb-3 rounded-[4px] border border-line bg-paper p-3 text-sm text-muted">Message request sent. You can send more once {other?.profile?.full_name ?? 'they'} accepts or replies — or once you follow each other.</p>
      )}
      {conv?.status === 'declined' && conv.requested_by === user.id && <p className="mb-3 rounded-[4px] border border-line bg-paper p-3 text-sm text-muted">This message request wasn’t accepted.</p>}
      {searchParams.error && <div className="mb-3"><FormMessage error={searchParams.error === 'pending' ? 'Your message request is waiting for a reply — you can send more once they accept.' : searchParams.error === 'declined' ? 'This message request wasn’t accepted.' : searchParams.error === 'blocked' ? 'This conversation is closed because one of you has blocked the other.' : searchParams.error === 'rate' ? 'You’re sending messages very quickly. Please wait a few minutes.' : searchParams.error === 'pii' ? 'That looks like a Social Security number. For your safety, LanceNest never allows SSNs to be shared — please remove it.' : 'Your message didn’t send. Please try again.'} /></div>}
      {!(conv?.requested_by === user.id && ((conv?.status === 'request' && mySent > 0) || conv?.status === 'declined')) && <form action={sendMessage.bind(null, params.id)} className="sticky bottom-4 flex gap-2 rounded-[6px] border border-line bg-ivory p-2 shadow-card">
        <label htmlFor="msg" className="sr-only">Message</label>
        <textarea id="msg" name="body" required rows={2} maxLength={4000} defaultValue={searchParams.draft} placeholder="Write a message…" className="field resize-none border-0 focus:ring-0" />
        <SubmitButton className="btn btn-primary shrink-0 self-end" pendingText="Sending…">Send</SubmitButton>
      </form>}
      <p className="mt-3 text-center text-xs text-muted">Never share classified or Controlled Unclassified Information (CUI) in messages.</p>
    </div>
  );
}
