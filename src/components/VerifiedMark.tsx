/** Green check shown next to every verified service member, everywhere on LanceNest. */
export default function VerifiedMark({ size = 'sm', label = false }: { size?: 'sm' | 'md'; label?: boolean }) {
  const box = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <span className="ml-1.5 inline-flex items-center gap-1 align-middle" title="Verified service member — reviewed by LanceNest">
      <svg viewBox="0 0 24 24" className={`${box} shrink-0`} aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#2f7a3e" />
        <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label ? <span className="text-xs font-semibold text-[#2f7a3e]">Verified</span> : <span className="sr-only">Verified service member</span>}
    </span>
  );
}
