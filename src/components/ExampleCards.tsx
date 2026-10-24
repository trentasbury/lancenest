/**
 * Made-up examples of what LanceNest shows, for signed-out visitors. Clearly labeled "Example": no real member,
 * employer or job is shown, and nothing here is presented as real.
 */

function ExampleTag() {
  return <span className="rounded-full border border-brass/60 bg-brass/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-brass-dark">Example</span>;
}

/** A sample verified member profile, the way employers see it in search. */
export function ExampleMemberCard() {
  return (
    <div className="card p-5" aria-label="Example member profile (not a real person)">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy font-serif text-lg text-ivory" aria-hidden="true">JM</span>
          <div>
            <p className="font-semibold text-ink">Jordan M.</p>
            <p className="text-xs text-muted">U.S. Army veteran · Virginia</p>
          </div>
        </div>
        <ExampleTag />
      </div>
      <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-olive/40 bg-olive/10 px-2.5 py-0.5 text-[11px] font-semibold text-olive">✓ Verified service member</p>
      <dl className="mt-4 grid gap-2 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-muted">Military job</dt><dd className="text-right text-ink">25B IT Specialist</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted">Civilian fit</dt><dd className="text-right text-ink">Systems administrator · Help desk lead</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted">Clearance</dt><dd className="text-right text-ink">Secret (self-reported)</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted">Open to</dt><dd className="text-right text-ink">Remote or hybrid · $70K–$85K</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted">Available</dt><dd className="text-right text-ink">In 2 weeks</dd></div>
      </dl>
    </div>
  );
}

/** A sample job card, the way members see it. */
export function ExampleJobCard() {
  return (
    <div className="card p-5" aria-label="Example job (not a real posting)">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-navy">Logistics Coordinator</p>
          <p className="mt-1 text-sm text-muted">Verified employer · Norfolk, VA</p>
        </div>
        <ExampleTag />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="pill">Hybrid</span><span className="pill">Full-time</span>
        <span className="pill border-brass/50 bg-brass/10 text-brass-dark">Veteran preferred</span>
        <span className="pill border-olive/40 bg-olive/10 text-olive">Usually responds in 3 days</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-navy">$62K – $74K</p>
      <p className="mt-1 text-xs text-muted">Pay is posted on every job. Apply with your verified profile in one step.</p>
    </div>
  );
}
