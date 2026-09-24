/** LanceNest crest: spread wings over a small shield. Decorative. */
export default function Crest({ className = 'h-7 w-11', tone = 'brass' }: { className?: string; tone?: 'brass' | 'navy' | 'ivory' }) {
  const fill = tone === 'navy' ? '#102431' : tone === 'ivory' ? '#fffdf8' : '#b9975b';
  return (
    <svg viewBox="0 0 64 40" className={className} aria-hidden="true" fill={fill}>
      <path d="M31 15C24 7 13 4 2 6c8 3 13 7 17 12-6-1-11 0-15 2 7 2 13 4 18 8l9-4z" />
      <path d="M33 15c7-8 18-11 29-9-8 3-13 7-17 12 6-1 11 0 15 2-7 2-13 4-18 8l-9-4z" />
      <path d="M26 16h12v10c0 5-6 9-6 9s-6-4-6-9z" />
      <path d="M32 19.5l1.3 2.7 2.9.3-2.2 1.9.7 2.9-2.7-1.5-2.7 1.5.7-2.9-2.2-1.9 2.9-.3z" fill="#071821" />
    </svg>
  );
}
