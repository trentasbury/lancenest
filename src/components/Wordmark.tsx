import Link from 'next/link';
import Crest from './Crest';

export default function Wordmark({ tone = 'navy' }: { tone?: 'navy' | 'ivory' }) {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="LanceNest home">
      <Crest className="h-7 w-11" />
      <span className={`font-serif text-2xl font-semibold tracking-wordmark ${tone === 'ivory' ? 'text-ivory' : 'text-navy'}`}>
        LANCENEST
      </span>
    </Link>
  );
}
