export default function Pricing() {
  return (
    <main className="plain-surface container" style={{ padding: '72px 32px', maxWidth: 640 }}>
      <span className="eyebrow">Pricing</span>
      <h1 style={{ fontSize: 38, margin: '16px 0 32px' }}>How LanceNest is paid for.</h1>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>Free — 15% per project</h2>
        <p style={{ color: 'var(--slate)', fontSize: 15.5, lineHeight: 1.8 }}>
          Every freelancer starts here, free forever. LanceNest takes 15% from
          the freelancer's side of each completed job, deducted automatically
          when a client pays. No fee to the client beyond the agreed job
          amount, no listing fee, no fee to create or maintain a profile.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>Pro — 10% per project + $20/month</h2>
        <p style={{ color: 'var(--slate)', fontSize: 15.5, lineHeight: 1.8, marginBottom: 12 }}>
          Pro lowers the platform fee to 10% — a 5-point savings on every job —
          and adds:
        </p>
        <ul style={{ color: 'var(--slate)', fontSize: 15.5, lineHeight: 1.9, paddingLeft: 20 }}>
          <li>Priority placement in the public directory</li>
          <li>A verified badge on your profile</li>
          <li>AI proposal tools (coming soon)</li>
          <li>Instant payouts (coming soon)</li>
        </ul>
        <p style={{ marginTop: 16, fontSize: 14, color: 'var(--slate)' }}>
          The 5% fee reduction alone covers the $20 subscription once you're
          earning roughly $400/month or more through LanceNest — past that
          point, Pro is saving you money, not costing you any.
        </p>
        <p style={{ marginTop: 12 }}>
          <a href="/upgrade" style={{ color: 'var(--wood)', textDecoration: 'underline', fontSize: 14 }}>
            See the full breakdown →
          </a>
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>Payments</h2>
        <p style={{ color: 'var(--slate)', fontSize: 15.5, lineHeight: 1.8 }}>
          All payments are processed through Stripe. Freelancers connect a
          Stripe account to receive payouts directly to their bank. LanceNest
          never holds client or freelancer funds directly.
        </p>
      </section>
    </main>
  );
}
