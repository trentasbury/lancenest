import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import SubmitButton from '@/components/SubmitButton';
import { approveReview, removeReview } from './actions';

export const metadata: Metadata = { title: 'Reviews to approve', robots: { index: false } };

type Held = {
  id: string; rating: number; body: string | null; created_at: string; contract_id: string;
  reviewer: { full_name: string | null; created_at: string } | null; reviewee: { full_name: string | null; username: string | null } | null;
  contract: { title: string; booking_fee_cents: number | null; booking_fee_payer: string; created_at: string } | null;
};

/**
 * Reviews from client accounts under 30 days old wait here before they show or count toward ratings, so a freelancer
 * can't buy themselves 5 stars through a second account. Warning signs are listed on each one.
 */
export default async function HeldReviews() {
  await requireAdmin('/admin/reviews');
  const admin = createAdminClient();
  const { data } = await admin.from('reviews')
    .select('id, rating, body, created_at, contract_id, reviewer:profiles!reviews_reviewer_id_fkey(full_name, created_at), reviewee:profiles!reviews_reviewee_id_fkey(full_name, username), contract:contracts(title, booking_fee_cents, booking_fee_payer, created_at)')
    .eq('held', true).order('created_at').limit(100);
  const rows = (data ?? []) as unknown as Held[];
  const day = 86400000;
  return (
    <div className="container-page max-w-4xl py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-navy">← Admin</Link>
      <h1 className="mt-3 font-serif text-4xl font-medium">Reviews to approve</h1>
      <p className="mt-2 text-muted">Reviews from client accounts under 30 days old wait here. Approve the real ones; remove any that look bought or fake.</p>
      <ul className="card mt-6 divide-y divide-line">
        {rows.length === 0 && <li className="p-5 text-sm text-muted">Nothing waiting.</li>}
        {rows.map((r) => {
          const signs = [
            r.contract?.booking_fee_payer === 'freelancer' && 'the freelancer paid the booking fee',
            (r.contract?.booking_fee_cents ?? 0) <= 499 && 'smallest possible booking fee',
            r.reviewer && Date.parse(r.created_at) - Date.parse(r.reviewer.created_at) < 3 * day && 'client account made within 3 days of the review',
            r.contract && Date.parse(r.created_at) - Date.parse(r.contract.created_at) < day && 'job reviewed within a day of booking',
            r.reviewer?.full_name && r.reviewee?.full_name && r.reviewer.full_name.trim().split(/\s+/).pop()?.toLowerCase() === r.reviewee.full_name.trim().split(/\s+/).pop()?.toLowerCase() && 'same last name',
          ].filter(Boolean) as string[];
          return (
            <li key={r.id} className="space-y-2 p-5 text-sm">
              <p className="font-medium text-navy">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)} · {r.reviewer?.full_name ?? 'Client'} → {r.reviewee?.username ? <Link href={`/veterans/${r.reviewee.username}`} className="underline">{r.reviewee.full_name}</Link> : r.reviewee?.full_name}</p>
              <p className="text-xs text-muted">“{r.contract?.title ?? 'Job'}” · <Link href={`/freelance/contracts/${r.contract_id}`} className="underline">contract</Link> · reviewed {new Date(r.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}</p>
              {r.body && <p className="text-ink/85">{r.body}</p>}
              {signs.length > 0 && <p className="rounded-lg border border-signal/30 bg-signal/5 px-3 py-2 text-xs text-signal">Check: {signs.join(' · ')}</p>}
              <div className="flex gap-2">
                <form action={approveReview.bind(null, r.id)}><SubmitButton className="btn btn-primary py-1.5 text-xs" pendingText="…">Approve</SubmitButton></form>
                <form action={removeReview.bind(null, r.id)}><SubmitButton className="btn btn-ghost py-1.5 text-xs text-signal" pendingText="…">Remove</SubmitButton></form>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
