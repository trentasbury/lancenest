import Link from 'next/link';

/** Line icons for the member profile (24×24, drawn in the current text color). */
const PATHS: Record<string, React.ReactNode> = {
  pencil: <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
  overview: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  experience: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7M3 12.5h18" /></>,
  education: <><path d="m2 9 10-5 10 5-10 5z" /><path d="M6 11v5c0 1.2 2.7 3 6 3s6-1.8 6-3v-5M22 9v6" /></>,
  skills: <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z" />,
  posts: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4.2 3.6c-.3.3-.8 0-.8-.4z" />,
  photos: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-8 8" /></>,
  resume: <><path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  settings: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></>,
  pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  shield: <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  bell: <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M9 11h6M9 15h4" /></>,
  people: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c.6-3.3 3-5.2 6-5.2s5.4 1.9 6 5.2" /><path d="M16 4.9a3 3 0 0 1 0 6M18.5 14.9c1.4.8 2.3 2.4 2.5 5.1" /></>,
  chevron: <path d="m9 6 6 6-6 6" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
};

export function Icon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

/** Uppercase, letter-spaced section title with an Edit link for the profile owner. */
export function SectionHead({ id, title, edit }: { id?: string; title: string; edit?: string | null }) {
  return (
    <div id={id} className="flex scroll-mt-24 items-center justify-between gap-3 border-b border-line/80 pb-3">
      <h2 className="font-serif text-[15px] font-semibold uppercase tracking-[0.22em] text-ink">{title}</h2>
      {edit && (
        <Link href={edit} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/80 hover:text-navy">
          <Icon name="pencil" className="h-4 w-4" /> Edit
        </Link>
      )}
    </div>
  );
}

/** Circular progress for Profile Strength. */
export function StrengthRing({ pct }: { pct: number }) {
  const r = 46, c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto h-32 w-32">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="9" className="text-line" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" className="text-brass"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-3xl font-semibold text-ink">{pct}%</span>
        <span className="text-[11px] text-muted">Complete</span>
      </div>
    </div>
  );
}

/** Turns a free-text description into bullet points (one per line; leading dashes and bullets removed). */
export function Bullets({ text }: { text: string | null }) {
  const lines = (text ?? '').split(/\r?\n/).map((l) => l.replace(/^\s*[-•*·]\s*/, '').trim()).filter(Boolean);
  if (!lines.length) return null;
  if (lines.length === 1) return <p className="mt-2 text-sm leading-relaxed text-ink/85">{lines[0]}</p>;
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink/85">
      {lines.map((l, i) => <li key={i}>{l}</li>)}
    </ul>
  );
}
