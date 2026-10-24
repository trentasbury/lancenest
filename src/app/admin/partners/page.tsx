import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import SubmitButton from '@/components/SubmitButton';
import { SITE } from '@/lib/email';
import { createPartnerCode, setPartnerCodeActive } from './actions';

export const metadata: Metadata = { title: 'Partner Pro codes', robots: { index: false } };

const ERRORS: Record<string, string> = { input: 'Use 4–32 letters, numbers or dashes for the code, and name the partner.', taken: 'That code already exists.' };

export default async function PartnerCodes(props: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const sp = await props.searchParams;
  await requireAdmin('/admin/partners');
  const { data } = await createAdminClient().from('partner_codes').select('id, code, partner_name, months, max_uses, uses, expires_at, active, created_at').order('created_at', { ascending: false }).limit(200);
  return (
    <div className="container-page max-w-4xl py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-navy">← Admin</Link>
      <h1 className="mt-3 font-serif text-4xl font-medium">Partner Pro codes</h1>
      <p className="mt-2 text-muted">Give a transition office, veterans’ group or nonprofit a code for free months of Pro. Each verified member can use one partner code, ever. Share the link so members don’t have to type it.</p>
      {sp.error && <p role="alert" className="mt-4 text-sm text-signal">{ERRORS[sp.error] ?? ERRORS.input}</p>}
      {sp.saved && <p className="mt-4 text-sm text-olive">Code created.</p>}
      <form action={createPartnerCode} className="card mt-6 grid gap-3 p-5 sm:grid-cols-2">
        <div><label htmlFor="pc-code" className="field-label">Code</label><input id="pc-code" name="code" required maxLength={32} placeholder="TAP-LEJEUNE" className="field uppercase" /></div>
        <div><label htmlFor="pc-partner" className="field-label">Partner</label><input id="pc-partner" name="partner" required maxLength={120} placeholder="Camp Lejeune Transition Readiness" className="field" /></div>
        <div><label htmlFor="pc-months" className="field-label">Months of Pro</label><input id="pc-months" name="months" type="number" min={1} max={12} defaultValue={6} className="field" /></div>
        <div><label htmlFor="pc-max" className="field-label">Use limit <span className="font-normal text-muted">(optional)</span></label><input id="pc-max" name="max_uses" type="number" min={1} placeholder="500" className="field" /></div>
        <div><label htmlFor="pc-exp" className="field-label">Expires <span className="font-normal text-muted">(optional)</span></label><input id="pc-exp" name="expires" type="date" className="field" /></div>
        <div className="flex items-end"><SubmitButton className="btn btn-primary w-full" pendingText="Creating…">Create code</SubmitButton></div>
      </form>
      <ul className="card mt-6 divide-y divide-line">
        {(data ?? []).length === 0 && <li className="p-5 text-sm text-muted">No codes yet.</li>}
        {(data ?? []).map((c) => (
          <li key={c.id as string} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div className="min-w-0">
              <p className="font-mono font-semibold text-navy">{c.code as string} <span className="font-sans font-normal text-muted">· {c.partner_name as string}</span></p>
              <p className="text-xs text-muted">{c.months as number} months · used {c.uses as number}{c.max_uses ? ` of ${c.max_uses}` : ''}{c.expires_at ? ` · expires ${new Date(c.expires_at as string).toLocaleDateString('en-US', { dateStyle: 'medium' })}` : ''} · {c.active ? 'active' : 'off'}</p>
              <p className="mt-1 break-all text-xs text-muted">{SITE}/partner/{c.code as string}</p>
            </div>
            <form action={setPartnerCodeActive.bind(null, c.id as string, !c.active)}><SubmitButton className="btn btn-outline py-1.5 text-xs" pendingText="…">{c.active ? 'Turn off' : 'Turn on'}</SubmitButton></form>
          </li>
        ))}
      </ul>
    </div>
  );
}
