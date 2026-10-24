'use client';

import { useActionState } from 'react';
import SubmitButton from '@/components/SubmitButton';
import { explainFit, type FitState } from '@/app/jobs/fitActions';

export default function FitExplainer({ slug }: { slug: string }) {
  const [state, action] = useActionState<FitState>(explainFit.bind(null, slug), {});
  return (
    <div className="rounded-xl border border-navy/20 bg-paper p-4 text-sm">
      {state.text ? (
        <>
          <p className="font-semibold text-navy">How you fit</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink/90">{state.text}</pre>
          <p className="mt-2 text-[11px] text-muted">An AI read of your profile and this job. Only you see it.</p>
        </>
      ) : (
        <form action={action}>
          <p className="font-semibold text-navy">Is this a fit for you?</p>
          <p className="mt-1 text-xs text-muted">See how your service and skills line up with this job, what to address, and what to say in the interview.</p>
          {state.error && <p className="mt-2 text-xs text-signal">{state.error}</p>}
          <SubmitButton className="btn btn-outline mt-3 w-full py-2" pendingText="Reading the job…">Show how I fit</SubmitButton>
        </form>
      )}
    </div>
  );
}
