import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import SubmitButton from '@/components/SubmitButton';
import EmptyState from '@/components/EmptyState';
import { decideCompany } from '../actions';

export const metadata: Metadata = { title: 'Company verification', robots: { index: false } };

type Details = { website?: string; role?: string; linkedin?: string | null; ein?: string | null; phone?: string | null; submitted_at?: string };
const host = (u?: string | null) => { try { return u ? new URL(u).hostname.replace(/^www\./, '').toLowerCase() : ''; } catch { return ''; } };

export default async function CompanyQueue() {
  await requireAdmin('/admin/companies');
  const admin = createAdminClient();
  const [{ data: pending }, { data: verified }] = await Promise.all([
    admin.from('companies').select('id, name, slug, owner_id, verification_details, created_at').eq('verification_status', 'pending').order('updated_at'),
    admin.from('companies').select('id, name, slug').eq('verification_status', 'verified').order('updated_at', { ascending: false }).limit(20),
  ]);
  // Owner emails power the strongest signal: does their login email match the company website?
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailOf = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? '']));

  return (
    <>
      <section className="bg-navy-deep text-ivory">
        <div className="container-page py-10">
          <Link href="/admin" className="text-sm text-cream/70 hover:text-brass">← Admin</Link>
          <h1 className="mt-3 font-serif text-4xl font-medium text-ivory">Company verification</h1>
          <p className="mt-1 text-cream/75">Approve only real employers. Rejecting or revoking pauses their open jobs.</p>
        </div>
      </section>
      <div className="container-page max-w-4xl space-y-5 py-10">
        {(pending ?? []).length === 0 && <EmptyState title="No companies waiting." body="New submissions appear here, and you’ll get a notification." />}
        {(pending ?? []).map((c) => {
          const d = (c.verification_details ?? {}) as Details;
          const email = emailOf.get(c.owner_id as string) ?? '';
          const emailDomain = email.split('@')[1]?.toLowerCase() ?? '';
          const site = host(d.website);
          const match = !!site && (emailDomain === site || emailDomain.endsWith(`.${site}`));
          const freeMail = /^(gmail|yahoo|outlook|hotmail|icloud|aol|proton(mail)?)\./.test(emailDomain);
          return (
            <div key={c.id as string} className="card p-6">
              <p className="font-serif text-2xl">{c.name as string}</p>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div><dt className="inline text-muted">Website: </dt><dd className="inline"><a href={d.website} target="_blank" rel="noopener noreferrer" className="text-navy underline">{d.website}</a></dd></div>
                <div><dt className="inline text-muted">Contact: </dt><dd className="inline">{email} · {d.role}</dd></div>
                {d.linkedin && <div><dt className="inline text-muted">LinkedIn: </dt><dd className="inline break-all">{d.linkedin}</dd></div>}
                {d.ein && <div><dt className="inline text-muted">EIN: </dt><dd className="inline">{d.ein}</dd></div>}
                {d.phone && <div><dt className="inline text-muted">Phone: </dt><dd className="inline">{d.phone}</dd></div>}
              </dl>
              <p className={`mt-3 text-sm font-medium ${match ? 'text-olive' : freeMail ? 'text-signal' : 'text-brass-dark'}`}>
                {match ? '✓ Login email matches the company website domain' : freeMail ? '⚠ Signed up with a personal email — confirm by calling the company or checking LinkedIn' : '⚠ Email domain doesn’t match the website — check carefully'}
              </p>
              <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-end">
                <form action={decideCompany.bind(null, c.id as string, 'rejected')} className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1"><label className="field-label" htmlFor={`n-${c.id}`}>Reason (sent to employer if rejected)</label><input id={`n-${c.id}`} name="note" maxLength={300} className="field" /></div>
                  <SubmitButton className="btn btn-outline border-signal text-signal hover:bg-signal hover:text-ivory" pendingText="…">Reject</SubmitButton>
                </form>
                <form action={decideCompany.bind(null, c.id as string, 'verified')}><SubmitButton className="btn btn-primary w-full" pendingText="…">Approve</SubmitButton></form>
              </div>
            </div>
          );
        })}
        {(verified ?? []).length > 0 && (
          <section className="pt-6">
            <p className="eyebrow">Recently verified</p>
            <ul className="card mt-3 divide-y divide-line">
              {(verified ?? []).map((c) => (
                <li key={c.id as string} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <Link href={`/companies/${c.slug}`} className="text-navy hover:underline">{c.name as string}</Link>
                  <form action={decideCompany.bind(null, c.id as string, 'revoked')}><button className="text-xs text-signal underline">Revoke</button></form>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
