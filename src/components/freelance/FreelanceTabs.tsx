import Link from 'next/link';

export type FreelanceTab = 'find' | 'proposals' | 'services' | 'earnings' | 'profile';

const TABS: [FreelanceTab, string, string][] = [
  ['find', 'Find freelance work', '/freelance'],
  ['proposals', 'My proposals', '/freelance/proposals'],
  ['services', 'Offer your services', '/freelance/services/mine'],
  ['earnings', 'Earnings', '/freelance/earnings'],
  ['profile', 'Freelancer profile', '/freelance/profile'],
];

/**
 * The freelancer's two ways to get work, side by side: find projects clients posted (and send proposals), or offer
 * services clients can book. Shown on every freelance page a service member uses.
 */
export default function FreelanceTabs({ active, dark = false }: { active: FreelanceTab; dark?: boolean }) {
  return (
    <nav aria-label="Freelance" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className={`flex min-w-max gap-1 border-b ${dark ? 'border-cream/20' : 'border-line'}`}>
        {TABS.map(([key, label, href]) => {
          const on = key === active;
          return (
            <li key={key}>
              <Link href={href} aria-current={on ? 'page' : undefined}
                className={`-mb-px inline-block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${on
                  ? (dark ? 'border-brass font-semibold text-ivory' : 'border-navy font-semibold text-navy')
                  : (dark ? 'border-transparent text-cream/75 hover:text-ivory' : 'border-transparent text-muted hover:text-navy')}`}>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
