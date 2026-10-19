import Link from 'next/link';
import { initials } from '@/lib/format';
import type { Profile } from '@/lib/types';

/** LinkedIn-style identity card for the feed's left column: cover, photo, name, headline, counts, shortcuts. */
export default function ProfileMini({ profile, followers, following, saved }: { profile: Profile; followers: number; following: number; saved: boolean }) {
  const href = profile.username ? `/veterans/${profile.username}` : null;
  const name = <span className="block truncate text-base font-semibold text-ink">{profile.full_name}</span>;
  return (
    <div className="card overflow-hidden">
      <div className="h-14 bg-gradient-to-r from-navy-deep via-navy to-navy-soft" aria-hidden="true" />
      <div className="-mt-8 px-5 pb-4">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="" className="h-16 w-16 rounded-full border-[3px] border-ivory object-cover shadow-sm" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-ivory bg-navy font-serif text-lg text-brass shadow-sm">{initials(profile.full_name)}</span>
        )}
        <div className="mt-2">
          {href ? <Link href={href} className="hover:underline">{name}</Link> : name}
          {profile.headline && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{profile.headline}</p>}
        </div>
      </div>
      <div className="border-t border-line/80 px-5 py-3 text-sm">
        <Link href="/network/people?tab=followers" className="flex items-center justify-between py-1 text-muted hover:text-navy">
          Followers <span className="font-semibold text-navy">{followers}</span>
        </Link>
        <Link href="/network/people?tab=following" className="flex items-center justify-between py-1 text-muted hover:text-navy">
          Following <span className="font-semibold text-navy">{following}</span>
        </Link>
      </div>
      <div className="border-t border-line/80 px-5 py-3 text-sm">
        <Link href={saved ? '/network' : '/network?view=saved'} className="block py-1 font-medium text-ink hover:text-navy">{saved ? '← Back to feed' : 'Saved posts'}</Link>
        {href && <Link href={href} className="block py-1 font-medium text-ink hover:text-navy">View my profile</Link>}
      </div>
    </div>
  );
}
