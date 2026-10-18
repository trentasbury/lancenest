'use client';

import Link from 'next/link';
import { accountLinks, profileLink } from '@/lib/nav';
import { initials } from '@/lib/format';
import { markSignedOut, useMe } from './useMe';

const ROLE_LABEL: Record<string, string> = { veteran: 'Service member', employer: 'Employer', admin: 'Admin' };

/** Desktop: notifications bell and the account menu for signed-in members. */
export default function NavAccount({ signOutAction }: { signOutAction: () => Promise<void> }) {
  const me = useMe();
  const signed = me?.signedIn ? me : null;
  const unread = signed?.unread ?? 0;
  const firstName = signed?.fullName?.split(' ')[0];

  return (
    <>
      <Link href="/notifications" className="relative flex h-9 w-9 items-center justify-center rounded-full text-navy hover:bg-cream" aria-label={unread ? `${unread} unread notifications` : 'Notifications'}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brass px-1 text-[10px] font-semibold text-navy-deep">{unread > 9 ? '9+' : unread}</span>
        )}
      </Link>
      <details className="relative" data-autoclose>
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-ink hover:text-brass-dark">
          {signed?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={signed.avatarUrl} alt="" className="h-8 w-8 rounded-full border border-brass object-cover" />
          ) : signed ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-brass bg-navy font-serif text-xs text-brass">{initials(signed.fullName)}</span>
          ) : (
            <span className="h-8 w-8 animate-pulse rounded-full border border-line bg-line/60" aria-hidden="true" />
          )}
          <span className="hidden xl:inline">{firstName ?? 'Account'}</span>
          <span aria-hidden="true" className="text-xs text-muted">▾</span>
        </summary>
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-[4px] border border-line bg-ivory p-2 text-sm shadow-card">
          {signed && (
            <div className="border-b border-line px-2 pb-3 pt-1">
              <div className="flex items-center gap-3">
                {signed.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={signed.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full border border-brass object-cover" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brass bg-navy font-serif text-sm text-brass">{initials(signed.fullName)}</span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{signed.fullName ?? 'Your account'}</p>
                  <p className="text-xs text-muted">{ROLE_LABEL[signed.role ?? 'veteran'] ?? 'Member'}</p>
                </div>
              </div>
              {(() => {
                const p = profileLink(signed.role, signed.username, signed.companySlug);
                return <Link href={p.href} className="btn btn-outline mt-3 w-full py-1.5 text-sm">{p.label}</Link>;
              })()}
            </div>
          )}
          <div className="pt-1">
            {accountLinks(signed?.role).map((l) => (
              <Link key={l.href} href={l.href} className="block rounded-[3px] px-3 py-2 hover:bg-cream">{l.label}</Link>
            ))}
          </div>
          <form action={signOutAction} onSubmit={markSignedOut} className="mt-1 border-t border-line pt-1">
            <button type="submit" className="w-full rounded-[3px] px-3 py-2 text-left text-signal hover:bg-signal/5">Log out</button>
          </form>
        </div>
      </details>
    </>
  );
}
