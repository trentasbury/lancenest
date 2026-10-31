import Link from 'next/link';
import LogoMark from './LogoMark';

export default function Wordmark({ tone = 'navy' }: { tone?: 'navy' | 'ivory' }) {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="LanceNest home">
      <LogoMark className="h-7 w-11" tone={tone === 'ivory' ? 'dark' : 'light'} />
      <span className={`font-serif text-2xl font-semibold tracking-wordmark ${tone === 'ivory' ? 'text-ivory' : 'text-navy'}`}>
        LANCENEST
      </span>
    </Link>
  );
}
