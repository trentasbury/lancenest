export default function Pricing() {
  return (
    <main className="container" style={{ padding: '72px 32px', maxWidth: 640 }}>
      <span className="eyebrow">Pricing</span>
      <h1 style={{ fontSize: 38, margin: '16px 0 32px' }}>How LanceNest is paid for.</h1>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>Platform fee</h2>
        <p style={{ color: 'var(--slate)', fontSize: 15.5, lineHeight: 1.8 }}>
          LanceNest takes a flat 10% fee from the freelancer's side of every
          completed job, deducted automatically when a client pays. There is
          no fee to the client beyond the agreed job amount, no listing fee,
          and no fee for creating or maintaining a profile. This applies
          equally to every freelancer on the platform, whether or not they
          subscribe to Pro.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>LanceNest Pro — optional</h2>
        <p style={{ color: 'var(--slate)', fontSize: 15.5, lineHeight: 1.8, marginBottom: 12 }}>
          Freelancers can optionally subscribe to LanceNest Pro for $15/month.
          Pro does not change the 10% platform fee — it adds:
        </p>
        <ul style={{ color: 'var(--slate)', fontSize: 15.5, lineHeight: 1.9, paddingLeft: 20 }}>
          <li>Priority placement in the public directory</li>
          <li>A Pro badge on your profile</li>
        </ul>
        <p style={{ marginTop: 16 }}>
          <a href="/upgrade" style={{ color: 'var(--gold-deep)', textDecoration: 'underline', fontSize: 14 }}>
            See upgrade details →
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
