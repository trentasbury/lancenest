'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PUBLIC_LINKS } from '@/lib/nav';

/** Simple line icons for the signed-in menu (24×24, drawn with the text color). */
const ICONS: Record<string, React.ReactNode> = {
  network: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  people: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c.6-3.3 3-5.2 6-5.2s5.4 1.9 6 5.2" /><path d="M16 4.9a3 3 0 0 1 0 6M18.5 14.9c1.4.8 2.3 2.4 2.5 5.1" /></>,
  jobs: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7M3 12.5h18" /></>,
  candidates: <><circle cx="10" cy="8" r="3.4" /><path d="M3.5 20c.7-3.4 3.2-5.3 6.5-5.3 1.4 0 2.6.3 3.6.9" /><circle cx="17.5" cy="17" r="2.6" /><path d="m19.5 19 1.8 1.8" /></>,
  freelance: <><rect x="4" y="5" width="16" height="11" rx="1.6" /><path d="M2.5 19h19" /></>,
  messages: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4.2 3.6c-.3.3-.8 0-.8-.4z" />,
};

const MEMBER = [
  { href: '/network', label: 'Network', icon: 'network', cls: 'nav-not-client' },
  { href: '/people', label: 'People', icon: 'people', cls: 'nav-not-client' },
  { href: '/jobs', label: 'Jobs', icon: 'jobs', cls: 'nav-not-employer nav-not-client' },
  { href: '/employer/candidates', label: 'Candidates', icon: 'candidates', cls: 'nav-employer' },
  { href: '/freelance', label: 'Freelance', icon: 'freelance', cls: '' },
  { href: '/messages', label: 'Messages', icon: 'messages', cls: '' },
];

/**
 * Desktop top menu. Signed-out visitors get text links; members get LinkedIn-style icons with labels and
 * a bar under the section they're in. Both sets are in the page; CSS shows the right one (see Navbar).
 */
export default function NavLinks() {
  const pathname = usePathname() ?? '/';
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <nav className="hidden h-full items-stretch text-ink lg:flex" aria-label="Main">
      {PUBLIC_LINKS.map((l) => (
        <Link key={`out-${l.href}`} href={l.href}
          className={`nav-out flex items-center px-4 text-[14px] transition-colors hover:text-brass-dark ${active(l.href) ? 'font-semibold text-navy' : ''}`}>
          {l.label}
        </Link>
      ))}
      {MEMBER.map((l) => {
        const on = active(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={on ? 'page' : undefined}
            className={`nav-in ${l.cls} group relative flex min-w-[76px] flex-col items-center justify-center gap-1 px-2 text-[12px] transition-colors ${on ? 'text-navy' : 'text-muted hover:text-navy'}`}>
            <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] transition-transform duration-150 group-hover:-translate-y-px" fill="none" stroke="currentColor" strokeWidth={on ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {ICONS[l.icon]}
            </svg>
            <span className={on ? 'font-semibold' : ''}>{l.label}</span>
            <span aria-hidden="true" className={`absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-navy transition-opacity ${on ? 'opacity-100' : 'opacity-0'}`} />
          </Link>
        );
      })}
    </nav>
  );
}
