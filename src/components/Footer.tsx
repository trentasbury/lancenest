import Link from 'next/link';
import Wordmark from './Wordmark';

export default function Footer() {
  return (
    <footer className="bg-navy-deep text-cream">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Wordmark tone="ivory" />
          <p className="mt-4 max-w-xs font-serif text-lg italic text-brass-light">Veteran Jobs. Built for What’s Next.</p>
        </div>
        <div>
          <p className="eyebrow text-brass">Veterans</p>
          <ul className="mt-4 space-y-2.5 text-sm text-cream/80">
            <li><Link href="/jobs" className="hover:text-brass">Find jobs</Link></li>
            <li><Link href="/resources" className="hover:text-brass">Translate your MOS</Link></li>
            <li><Link href="/signup?role=veteran" className="hover:text-brass">Create a profile</Link></li>
            <li><Link href="/plans" className="hover:text-brass">Veteran plans</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow text-brass">Employers</p>
          <ul className="mt-4 space-y-2.5 text-sm text-cream/80">
            <li><Link href="/employers" className="hover:text-brass">Plans</Link></li>
            <li><Link href="/signup?role=employer" className="hover:text-brass">Create a company account</Link></li>
            <li><Link href="/about" className="hover:text-brass">About LanceNest</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-6 text-xs tracking-[0.14em] text-cream/60 sm:flex-row">
          <span>© {new Date().getFullYear()} LANCENEST</span>
          <span className="flex gap-5">
            <Link href="/privacy" className="hover:text-brass">PRIVACY</Link>
            <Link href="/terms" className="hover:text-brass">TERMS</Link>
          </span>
        </div>
      </div>
        <p className="mt-6 text-[11px] leading-relaxed text-cream/50">
          LanceNest is an independent company. It is not affiliated with, endorsed by, or sponsored by the U.S. Department of Defense,
          the Department of Veterans Affairs, the U.S. Armed Forces, or any branch of service. Military occupation codes are used for descriptive purposes only.
        </p>
      </footer>
  );
}
