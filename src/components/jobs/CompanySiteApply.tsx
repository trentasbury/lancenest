'use client';

import { useState } from 'react';
import { confirmSiteApply } from '@/app/jobs/actions';
import SubmitButton from '@/components/SubmitButton';
import { toast } from '@/components/Toaster';

/**
 * "Apply on company site": opens the employer's application in a new tab (LanceNest stays open here),
 * then asks whether they finished, so My applications stays accurate — like LinkedIn's "Did you apply?".
 */
export default function CompanySiteApply({ jobId, slug, company, primary }: { jobId: string; slug: string; company: string; primary: boolean }) {
  const [asked, setAsked] = useState(false);
  return (
    <div className="space-y-2">
      <a href={`/api/jobs/${jobId}/external`} target="_blank" rel="noopener"
        onClick={() => setTimeout(() => setAsked(true), 300)}
        className={`btn w-full ${primary ? 'btn-primary' : 'btn-outline'}`} data-track="job_apply_company_site">
        Apply on company site ↗
      </a>
      {asked ? (
        <div role="status" className="rounded-xl border border-navy/20 bg-paper p-4 text-sm">
          <p className="font-medium text-ink">Did you apply on {company}’s site?</p>
          <p className="mt-0.5 text-xs text-muted">Let us know, and we’ll keep it in My applications so you can track it.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={confirmSiteApply.bind(null, jobId, slug, true)}>
              <SubmitButton className="btn btn-primary py-1.5 text-sm" pendingText="…">Yes, I applied</SubmitButton>
            </form>
            <form action={async () => { await confirmSiteApply(jobId, slug, false); setAsked(false); toast('Got it. You can apply anytime from this page.'); }}>
              <SubmitButton className="btn btn-ghost border border-line py-1.5 text-sm" pendingText="…">Not yet</SubmitButton>
            </form>
          </div>
        </div>
      ) : (
        <p className="text-center text-xs text-muted">Opens {company}’s application in a new tab.</p>
      )}
    </div>
  );
}
