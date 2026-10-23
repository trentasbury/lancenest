'use client';

import { useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from './Toaster';

/**
 * Submit button with a pending state. When the form's action finishes, the form can opt in to follow-ups
 * with data attributes:
 *   data-done="Report sent."  shows a confirmation toast
 *   data-reset                 clears the form (comments, messages)
 *   data-close                 closes the menu or panel (<details>) the form sits in
 * Nothing happens if the action came back with an ?error= on the page, so what the person typed is kept.
 */
export default function SubmitButton({
  children,
  pendingText = 'Working…',
  className = 'btn btn-primary w-full',
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const ref = useRef<HTMLButtonElement>(null);
  const started = useRef<string | null>(null);

  useEffect(() => {
    if (pending) { started.current = window.location.search; return; }
    if (started.current === null) return;
    const before = started.current;
    started.current = null;
    const form = ref.current?.form;
    if (!form) return;
    const now = window.location.search;
    if (now !== before && /(^|[?&])error=/.test(now)) return; // the action reported a problem: keep everything as typed
    if (form.dataset.reset !== undefined) form.reset();
    if (form.dataset.close !== undefined) {
      let d = form.closest('details');
      while (d) { d.open = false; d = d.parentElement?.closest('details') ?? null; }
    }
    if (form.dataset.done) toast(form.dataset.done);
  }, [pending]);

  return (
    <button ref={ref} type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
