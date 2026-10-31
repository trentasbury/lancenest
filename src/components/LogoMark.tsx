/**
 * The LanceNest mark: an L with an arrow rising out of it (a lance, and a launch). Navy and brass on light
 * backgrounds; ivory and brass on dark ones. Decorative: the name next to it carries the meaning.
 */
export default function LogoMark({ className = 'h-7 w-11', tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const base = tone === 'dark' ? '#fffdf8' : '#102431';
  const id = `ln-mark-${tone}`;
  return (
    <svg viewBox="0 0 510 320" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-shaft`} gradientUnits="userSpaceOnUse" x1="215" y1="236" x2="491" y2="49">
          <stop offset="0" stopColor={base} />
          <stop offset="0.28" stopColor={tone === 'dark' ? '#d9c9a8' : '#7a6136'} />
          <stop offset="0.6" stopColor="#b9975b" />
          <stop offset="1" stopColor="#d4b77c" />
        </linearGradient>
        <linearGradient id={`${id}-swoosh`} gradientUnits="userSpaceOnUse" x1="8" y1="309" x2="340" y2="124">
          <stop offset="0" stopColor="#7a6136" />
          <stop offset="1" stopColor="#c4a467" />
        </linearGradient>
      </defs>
      <path fill={base} d="M246 14Q250 11 257 11L336 11L252 153L139 203Z" />
      <path fill={`url(#${id}-swoosh)`} d="M8 309C60 268 170 200 340 124C250 175 150 250 89 285C60 297 30 302 8 309Z" />
      <path fill={`url(#${id}-shaft)`} d="M184 240L188 232Q285 158 403 97L332 94Q420 74 491 49Q448 108 422 170L423 113Q340 178 284 240Z" />
      <path fill={base} d="M188 232L434 231C412 251 394 268 381 278C373 284 363 287 352 287L118 287Z" />
    </svg>
  );
}
