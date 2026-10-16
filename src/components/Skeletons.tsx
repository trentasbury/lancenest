/**
 * Placeholder layouts shown the instant someone clicks a link, while the page loads.
 * Each one mirrors the real page's shape so content drops into place without jumping.
 */

function Bar({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/** The dark header band most pages open with. */
export function HeroSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <section className="bg-navy-deep">
      <div className="container-page py-10">
        <div className="h-3 w-32 animate-pulse rounded-[3px] bg-cream/15" />
        <div className={`mt-4 h-10 animate-pulse rounded-[3px] bg-cream/15 ${wide ? 'w-full max-w-xl' : 'w-72 max-w-full'}`} />
        <div className="mt-4 h-4 w-96 max-w-full animate-pulse rounded-[3px] bg-cream/10" />
      </div>
    </section>
  );
}

function PostSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <Bar className="h-11 w-11 rounded-full" />
        <div className="flex-1 space-y-2">
          <Bar className="h-4 w-40" />
          <Bar className="h-3 w-64 max-w-full" />
        </div>
      </div>
      <div className="mt-5 space-y-2">
        <Bar className="h-4 w-full" />
        <Bar className="h-4 w-11/12" />
        <Bar className="h-4 w-2/3" />
      </div>
      <div className="mt-5 flex gap-6 border-t border-line pt-4">
        <Bar className="h-4 w-14" />
        <Bar className="h-4 w-16" />
        <Bar className="h-4 w-12" />
      </div>
    </div>
  );
}

function SideCardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card p-5">
      <Bar className="h-5 w-40" />
      <div className="mt-5 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Bar className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Bar className="h-3.5 w-32" />
              <Bar className="h-3 w-44 max-w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Network feed: composer, posts, and the "Grow your network" rail. */
export function FeedSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <HeroSkeleton />
      <div className="container-page grid gap-8 py-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <div className="card p-5"><Bar className="h-12 w-full" /></div>
          <div className="flex gap-2">
            <Bar className="h-8 w-20 rounded-full" />
            <Bar className="h-8 w-24 rounded-full" />
            <Bar className="h-8 w-16 rounded-full" />
            <Bar className="h-8 w-20 rounded-full" />
            <Bar className="hidden h-8 w-24 rounded-full sm:block" />
          </div>
          {[0, 1, 2].map((i) => <PostSkeleton key={i} />)}
        </div>
        <aside className="hidden space-y-5 lg:block">
          <SideCardSkeleton />
          <SideCardSkeleton rows={3} />
        </aside>
      </div>
    </div>
  );
}

/** A single post or thread. */
export function PostDetailSkeleton() {
  return (
    <div className="container-page max-w-2xl space-y-5 py-10" aria-busy="true" aria-label="Loading">
      <Bar className="h-4 w-28" />
      <PostSkeleton />
      <div className="card space-y-4 p-5">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-3">
            <Bar className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2"><Bar className="h-3.5 w-32" /><Bar className="h-3.5 w-full" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Search-and-results pages (people, freelance, candidates): a filter bar and a grid of cards. */
export function ListSkeleton({ columns = 2, count = 6 }: { columns?: 1 | 2 | 3; count?: number }) {
  const grid = columns === 3 ? 'md:grid-cols-2 lg:grid-cols-3' : columns === 2 ? 'md:grid-cols-2' : '';
  return (
    <div className="container-page py-10" aria-busy="true" aria-label="Loading">
      <Bar className="h-10 w-72 max-w-full" />
      <Bar className="mt-3 h-4 w-96 max-w-full" />
      <div className="card mt-6 grid gap-3 p-5 sm:grid-cols-3">
        <Bar className="h-10" /><Bar className="h-10" /><Bar className="h-10" />
      </div>
      <div className={`mt-6 grid gap-3 ${grid}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="card flex gap-4 p-5">
            <Bar className="h-12 w-12 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2.5">
              <Bar className="h-4 w-2/3" />
              <Bar className="h-3.5 w-1/2" />
              <Bar className="h-3.5 w-5/6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Inbox-style lists (messages, notifications). */
export function InboxSkeleton() {
  return (
    <div className="container-page max-w-3xl py-10" aria-busy="true" aria-label="Loading">
      <Bar className="h-10 w-56" />
      <div className="card mt-6 divide-y divide-line">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-5">
            <Bar className="h-11 w-11 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Bar className="h-4 w-48 max-w-full" />
              <Bar className="h-3.5 w-full" />
            </div>
            <Bar className="h-3 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** One conversation thread. */
export function ThreadSkeleton() {
  return (
    <div className="container-page max-w-3xl py-10" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-3">
        <Bar className="h-11 w-11 rounded-full" />
        <div className="space-y-2"><Bar className="h-4 w-40" /><Bar className="h-3 w-56" /></div>
      </div>
      <div className="card mt-6 space-y-4 p-5">
        {[60, 40, 72, 52, 36].map((w, i) => (
          <div key={i} className="skeleton h-12 rounded-lg" style={{ width: `${w}%`, marginLeft: i % 2 ? 'auto' : undefined }} />
        ))}
        <Bar className="h-12 w-full" />
      </div>
    </div>
  );
}

/** Member and company profiles: banner, identity row, then sections beside a side rail. */
export function ProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <section className="bg-navy-deep">
        <div className="container-page flex flex-col gap-6 py-12 sm:flex-row sm:items-center">
          <div className="h-24 w-24 shrink-0 animate-pulse rounded-full bg-cream/15" />
          <div className="flex-1 space-y-3">
            <div className="h-9 w-64 max-w-full animate-pulse rounded-[3px] bg-cream/15" />
            <div className="h-4 w-80 max-w-full animate-pulse rounded-[3px] bg-cream/10" />
            <div className="h-4 w-48 animate-pulse rounded-[3px] bg-cream/10" />
          </div>
        </div>
      </section>
      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card space-y-3 p-7">
              <Bar className="h-6 w-40" />
              <Bar className="h-4 w-full" />
              <Bar className="h-4 w-5/6" />
              <Bar className="h-4 w-2/3" />
            </div>
          ))}
        </div>
        <aside className="hidden space-y-5 lg:block"><SideCardSkeleton rows={3} /></aside>
      </div>
    </div>
  );
}

/** Detail pages (a job, a project, a fair): title block, body, and an action rail. */
export function DetailSkeleton() {
  return (
    <div className="container-page py-10" aria-busy="true" aria-label="Loading">
      <Bar className="h-4 w-32" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <div className="card flex gap-5 p-7">
            <Bar className="h-14 w-14 shrink-0" />
            <div className="flex-1 space-y-3"><Bar className="h-8 w-3/4" /><Bar className="h-4 w-1/2" /><Bar className="h-6 w-2/3" /></div>
          </div>
          <div className="card space-y-3 p-7">
            {Array.from({ length: 7 }).map((_, i) => <Bar key={i} className={`h-4 ${i % 3 === 2 ? 'w-2/3' : 'w-full'}`} />)}
          </div>
        </div>
        <aside className="space-y-5"><div className="card space-y-3 p-6"><Bar className="h-11 w-full" /><Bar className="h-4 w-2/3" /></div></aside>
      </div>
    </div>
  );
}

/** Dashboards: a title, a row of stat tiles, then panels. */
export function DashboardSkeleton() {
  return (
    <div className="container-page py-12" aria-busy="true" aria-label="Loading">
      <Bar className="h-12 w-80 max-w-full" />
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <Bar key={i} className="h-28" />)}
      </div>
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <Bar className="h-64" />
        <Bar className="h-64" />
      </div>
    </div>
  );
}

/** Any other page: a header band and content blocks. */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <HeroSkeleton wide />
      <div className="container-page space-y-4 py-10">
        <Bar className="h-6 w-56" />
        <Bar className="h-4 w-full max-w-3xl" />
        <Bar className="h-4 w-full max-w-2xl" />
        <div className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Bar key={i} className="h-40" />)}
        </div>
      </div>
    </div>
  );
}
