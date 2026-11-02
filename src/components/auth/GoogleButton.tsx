import { GOOGLE_SIGNIN } from '@/lib/flags';

/**
 * "Continue with Google" plus an "or" divider, above the email form. A plain link (no Google script on our pages):
 * /auth/google starts the sign-in and Google sends the person back to /auth/callback.
 * Renders nothing until Google sign-in is switched on (see lib/flags.ts).
 */
export default function GoogleButton({ href, note, disabled = false }: { href: string; note?: React.ReactNode; disabled?: boolean }) {
  if (!GOOGLE_SIGNIN) return null;
  return (
    <div className="space-y-4">
      {disabled
        ? <button type="button" aria-disabled="true" title="Tick the box above first" className="btn w-full cursor-not-allowed border border-line bg-white text-ink/50 shadow-sm">Continue with Google</button>
        : <a href={href} className="btn w-full border border-line bg-white text-ink shadow-sm hover:border-navy/40 hover:bg-white">Continue with Google</a>}
      {note && <p className="-mt-2 text-center text-xs text-muted">{note}</p>}
      <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />or use email<span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
