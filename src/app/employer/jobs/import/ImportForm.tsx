'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { runImport, type ImportState } from './actions';

const HINTS: Record<string, [string, string]> = {
  greenhouse: ['Greenhouse job board name', 'From boards.greenhouse.io/yourcompany: enter “yourcompany”'],
  lever: ['Lever site name', 'From jobs.lever.co/yourcompany: enter “yourcompany”'],
  ashby: ['Ashby job board name', 'From jobs.ashbyhq.com/yourcompany: enter “yourcompany”'],
  xml: ['XML feed address', 'The https:// address of your job feed (the format Indeed and most job boards read)'],
};

export default function ImportForm({ paid, defaults }: { paid: boolean; defaults: { kind: string; source: string; autoSync: boolean } | null }) {
  const [state, action] = useActionState<ImportState, FormData>(runImport, {});
  const [kind, setKind] = useState(defaults?.kind ?? 'greenhouse');
  const r = state.result;
  return (
    <form action={action} className="card space-y-5 p-7">
      {state.error && <FormMessage error={state.error} />}
      {r && (
        <div className="rounded-xl border border-olive/40 bg-olive/10 p-4 text-sm">
          <p className="font-semibold text-olive">Found {r.found} job{r.found === 1 ? '' : 's'}.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink/85">
            {r.published > 0 && <li>{r.published} published (they had pay listed).</li>}
            {r.drafts > 0 && <li>{r.drafts} saved as drafts: add the pay range to publish them (required on LanceNest).</li>}
            {r.updated > 0 && <li>{r.updated} already here and updated.</li>}
            {r.closed > 0 && <li>{r.closed} closed because your job board no longer lists them.</li>}
            {r.skipped > 0 && <li>{r.skipped} skipped (couldn’t be saved).</li>}
            {r.limitHit && <li>Your plan’s open-job limit was reached, so the rest weren’t added. <Link href="/employers" className="text-navy underline">Upgrade for more job slots</Link>.</li>}
          </ul>
          <Link href="/employer/dashboard" className="btn btn-primary mt-3">Review your jobs</Link>
        </div>
      )}
      <fieldset>
        <legend className="field-label">Where your jobs are</legend>
        <div className="grid gap-2 sm:grid-cols-4">
          {Object.keys(HINTS).map((k) => (
            <label key={k} className={`cursor-pointer rounded-xl border px-3 py-2 text-center text-sm ${kind === k ? 'border-brass bg-brass/10 font-semibold' : 'border-line'}`}>
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {k === 'xml' ? 'XML feed' : k[0].toUpperCase() + k.slice(1)}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="source" className="field-label">{HINTS[kind][0]}</label>
        <input id="source" name="source" required defaultValue={defaults?.kind === kind ? defaults.source : ''} className="field" placeholder={kind === 'xml' ? 'https://' : 'yourcompany'} />
        <p className="mt-1.5 text-xs text-muted">{HINTS[kind][1]}</p>
      </div>
      <label className={`flex items-start gap-2 text-sm ${paid ? '' : 'opacity-60'}`}>
        <input type="checkbox" name="auto_sync" disabled={!paid} defaultChecked={!!defaults?.autoSync} className="mt-0.5 accent-navy" />
        <span>Keep in sync every day: new jobs come in and closed ones close here too. {!paid && <span className="text-muted">(Paid plans)</span>}</span>
      </label>
      <p className="text-xs text-muted">Imported jobs use your company’s job limits and the same rules as jobs you post by hand. Applicants can apply on LanceNest or on your hiring system.</p>
      <SubmitButton className="btn btn-primary" pendingText="Importing… this can take a minute">Import jobs</SubmitButton>
    </form>
  );
}
