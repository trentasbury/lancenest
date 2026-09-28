import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { TRAINING_CATEGORIES } from '@/lib/training';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { deleteProgram, saveProgram, setProgramStatus } from './actions';

export const metadata: Metadata = { title: 'Training & certification listings' };
const ERR: Record<string, string> = {
  required: 'Add a program title and a description of at least 20 characters.',
  domain: 'Program links must be on your verified company website (this protects members from phishing).',
  listing: 'Saved as a draft. Start a listing subscription to publish programs.',
  listing_first: 'Featured placement requires an active listing subscription.',
  event: 'Info sessions need a title, a start time at least 24 hours away, and an https:// link.',
  save: 'That didn’t save — please try again.',
};

export default async function TrainingPartnerPage({ searchParams }: { searchParams: { error?: string; saved?: string } }) {
  const { user } = await requireRole(['employer'], '/employer/training');
  const supabase = createClient();
  const { data: company } = await supabase.from('companies').select('id, name, is_verified, training_listing_active, training_featured').eq('owner_id', user.id).maybeSingle();
  if (!company) redirect('/employer/dashboard');
  const [{ data: programs }, { data: events }] = await Promise.all([
    supabase.from('training_programs').select('id, title, category, status').eq('company_id', company.id).order('created_at', { ascending: false }),
    supabase.from('training_events').select('title, starts_at').eq('company_id', company.id).gte('starts_at', new Date().toISOString()).order('starts_at'),
  ]);

  return (
    <div className="container-page max-w-4xl space-y-6 py-10">
      <Link href="/employer/dashboard" className="text-sm text-muted hover:text-navy">← Employer dashboard</Link>
      <h1 className="font-serif text-4xl font-medium">Training & certification listings</h1>
      <p className="text-muted">Reach verified service members, National Guard, Reserve, and veterans looking for their next certification. Flat pricing — never per student.</p>
      {searchParams.error && <FormMessage error={ERR[searchParams.error] ?? ERR.save} />}
      {searchParams.saved && <FormMessage message="Program saved." />}
      {!company.is_verified ? (
        <div className="card p-6"><p className="font-medium">Verify your company first.</p><Link href="/employer/dashboard" className="btn btn-primary mt-3">Go to verification</Link></div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="card p-5">
              <p className="eyebrow">Listing</p>
              {company.training_listing_active ? <p className="mt-2 text-sm text-olive">✓ Active — your live programs appear in the directory.</p> : (
                <div className="mt-2 space-y-2">
                  <form action="/api/billing/checkout" method="post"><input type="hidden" name="product" value="training_listing_month" /><button className="btn btn-primary w-full">$149/month</button></form>
                  <form action="/api/billing/checkout" method="post"><input type="hidden" name="product" value="training_listing_year" /><button className="w-full text-xs text-navy underline">or $1,490/year (2 months free)</button></form>
                </div>
              )}
            </div>
            <div className="card p-5">
              <p className="eyebrow">Featured</p>
              {company.training_featured ? <p className="mt-2 text-sm text-olive">✓ Your programs are featured at the top of their category.</p> : (
                <form action="/api/billing/checkout" method="post" className="mt-2"><input type="hidden" name="product" value="training_featured" /><button className="btn btn-outline w-full" disabled={!company.training_listing_active}>+$99/month</button>
                  <p className="mt-1 text-xs text-muted">Top of your category and in the Transition Hub.</p></form>
              )}
            </div>
            <div className="card p-5">
              <p className="eyebrow">Billing</p>
              <form action="/api/billing/portal" method="post" className="mt-2"><button className="btn btn-ghost w-full border border-line">Manage billing</button></form>
            </div>
          </section>

          <section className="card p-6">
            <p className="eyebrow">Your programs</p>
            {(programs ?? []).length === 0 ? <p className="mt-2 text-sm text-muted">No programs yet.</p> : (
              <ul className="mt-3 divide-y divide-line">
                {(programs ?? []).map((p) => (
                  <li key={p.id as string} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div><p className="font-medium">{p.title as string}</p><p className="text-xs text-muted">{p.category as string} · <span className={p.status === 'live' ? 'text-olive' : ''}>{p.status === 'live' ? 'Live' : 'Draft'}</span></p></div>
                    <div className="flex gap-2">
                      <form action={setProgramStatus.bind(null, p.id as string, p.status === 'live' ? 'draft' : 'live')}><SubmitButton className="btn btn-outline py-1.5 text-xs" pendingText="…">{p.status === 'live' ? 'Unpublish' : 'Publish'}</SubmitButton></form>
                      <form action={deleteProgram.bind(null, p.id as string)}><button className="btn btn-ghost py-1.5 text-xs text-signal">Delete</button></form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <form action={saveProgram} className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
              <p className="text-sm font-medium sm:col-span-2">Add a program</p>
              <input name="title" required placeholder="e.g. CompTIA Security+ bootcamp" className="field sm:col-span-2" />
              <select name="category" className="field">{TRAINING_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
              <select name="format" className="field"><option value="online">Online</option><option value="in_person">In person</option><option value="hybrid">Hybrid</option></select>
              <input name="location" placeholder="Location (if in person)" className="field" />
              <input name="duration" placeholder="Duration (e.g. 8 weeks)" className="field" />
              <input name="cost" placeholder="Cost (e.g. $2,400 or covered by GI Bill)" className="field" />
              <input name="url" required placeholder="https://yourcompany.com/program" className="field" />
              <textarea name="description" required rows={3} placeholder="What members will learn, and the certification they’ll earn" className="field sm:col-span-2" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="gi_bill_approved" className="accent-navy" />Approved for GI Bill benefits</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="publish" defaultChecked={!!company.training_listing_active} className="accent-navy" />Publish now</label>
              <div className="sm:col-span-2"><SubmitButton className="btn btn-primary" pendingText="Saving…">Save program</SubmitButton></div>
            </form>
          </section>

          <section className="card p-6">
            <p className="eyebrow">Sponsored info session · $500</p>
            <p className="mt-1 text-sm text-muted">We promote your live webinar or open house to members in the Training directory.</p>
            {(events ?? []).length > 0 && <ul className="mt-3 space-y-1 text-sm">{(events ?? []).map((e, i) => <li key={i}>✓ {e.title as string} — {new Date(e.starts_at as string).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</li>)}</ul>}
            <form action="/api/billing/checkout" method="post" className="mt-4 grid gap-3 sm:grid-cols-3">
              <input type="hidden" name="product" value="training_webinar" />
              <input name="event_title" required placeholder="Session title" className="field" />
              <input name="event_starts_at" type="datetime-local" required className="field" />
              <input name="event_url" required placeholder="https:// registration link" className="field" />
              <div className="sm:col-span-3"><button className="btn btn-outline" disabled={!company.is_verified}>Book and pay $500</button></div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
