import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import SubmitButton from '@/components/SubmitButton';
import { createPartnerBatch, setPartnerCodeActive, voidPartnerBatch } from './actions';

export const metadata: Metadata = { title: 'Partner Pro cards', robots: { index: false } };

const ERRORS: Record<string, string> = { input: 'Name the base, office or program.', save: 'The cards couldn’t be created. Please try again.' };
const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' });

export default async function PartnerCodes(props: { searchParams: Promise<{ error?: string }> }) {
  const sp = await props.searchParams;
  await requireAdmin('/admin/partners');
  const admin = createAdminClient();
  const [{ data: batches }, { data: shared }] = await Promise.all([
    admin.from('partner_batches').select('id, partner_name, months, card_count, transition_only, expires_at, voided_at, created_at').order('created_at', { ascending: false }).limit(100),
    admin.from('partner_codes').select('id, code, partner_name, months, max_uses, uses, expires_at, active').is('batch_id', null).order('created_at', { ascending: false }).limit(50),
  ]);
  const used = await Promise.all((batches ?? []).map(async (b) => (await admin.from('partner_codes').select('id', { count: 'exact', head: true }).eq('batch_id', b.id).gt('uses', 0)).count ?? 0));
  return (
    <div className="container-page max-w-4xl py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-navy">← Admin</Link>
      <h1 className="mt-3 font-serif text-4xl font-medium">Partner Pro cards</h1>
      <p className="mt-2 text-muted">
        Give a base, transition office or veterans’ program a stack of one-time cards for free months of Pro. Every card has its own code and QR and works
        once, so a card posted online is one free year, not everyone’s. Each verified member can use one card, ever; the months start the day it’s used
        and don’t stack on other free months. Unused cards expire 6 months after you make them. Members without a card get the smaller offers
        (Founding, Transition Pro, or 25% off their first year).
      </p>
      {sp.error && <p role="alert" className="mt-4 text-sm text-signal">{ERRORS[sp.error] ?? ERRORS.save}</p>}
      <form action={createPartnerBatch} className="card mt-6 grid gap-3 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2"><label htmlFor="pb-partner" className="field-label">Base, office or program</label><input id="pb-partner" name="partner" required maxLength={120} placeholder="Camp Lejeune Transition Readiness Program" className="field" /></div>
        <div><label htmlFor="pb-count" className="field-label">Number of cards</label><input id="pb-count" name="count" type="number" min={1} max={500} defaultValue={50} className="field" /></div>
        <div><label htmlFor="pb-months" className="field-label">Months of Pro</label><input id="pb-months" name="months" type="number" min={1} max={12} defaultValue={12} className="field" /></div>
        <p className="text-sm text-muted sm:col-span-2">Cards work for any verified service member, veteran or military spouse who’s handed one, transitioning or not. One use per card.</p>
        <div className="sm:col-span-2"><SubmitButton className="btn btn-primary" pendingText="Creating…">Create cards</SubmitButton></div>
      </form>

      <h2 className="mt-10 font-serif text-2xl font-medium">Card batches</h2>
      <ul className="card mt-3 divide-y divide-line">
        {(batches ?? []).length === 0 && <li className="p-5 text-sm text-muted">No cards yet.</li>}
        {(batches ?? []).map((b, i) => {
          const expired = Date.parse(b.expires_at as string) < Date.now();
          const state = b.voided_at ? 'voided' : expired ? 'expired' : 'active';
          return (
            <li key={b.id as string} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-navy">{b.partner_name as string}</p>
                <p className="text-xs text-muted">{b.card_count as number} cards · {used[i]} used · {b.months as number} months of Pro · {b.transition_only ? 'leaving the service only' : 'any verified member'} · {state === 'active' ? `expires ${fmt(b.expires_at as string)}` : state} · made {fmt(b.created_at as string)}</p>
              </div>
              <div className="flex gap-2">
                {state === 'active' && <Link href={`/admin/partners/batch/${b.id}`} className="btn btn-ghost border border-line py-1.5 text-xs">Print cards</Link>}
                {state === 'active' && <form action={voidPartnerBatch.bind(null, b.id as string)}><SubmitButton className="btn btn-ghost py-1.5 text-xs text-signal" pendingText="…">Void unused</SubmitButton></form>}
              </div>
            </li>
          );
        })}
      </ul>

      {(shared ?? []).length > 0 && (
        <>
          <h2 className="mt-10 font-serif text-2xl font-medium">Older shared codes</h2>
          <p className="mt-1 text-sm text-muted">Codes many people can use. Turn these off and hand out cards instead.</p>
          <ul className="card mt-3 divide-y divide-line">
            {(shared ?? []).map((c) => (
              <li key={c.id as string} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div className="min-w-0">
                  <p className="font-mono font-semibold text-navy">{c.code as string} <span className="font-sans font-normal text-muted">· {c.partner_name as string}</span></p>
                  <p className="text-xs text-muted">{c.months as number} months · used {c.uses as number}{c.max_uses ? ` of ${c.max_uses}` : ''}{c.expires_at ? ` · expires ${fmt(c.expires_at as string)}` : ''} · {c.active ? 'active' : 'off'}</p>
                </div>
                <form action={setPartnerCodeActive.bind(null, c.id as string, !c.active)}><SubmitButton className="btn btn-outline py-1.5 text-xs" pendingText="…">{c.active ? 'Turn off' : 'Turn on'}</SubmitButton></form>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
