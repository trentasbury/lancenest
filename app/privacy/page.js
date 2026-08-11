export default function Privacy() {
  return (
    <main className="plain-surface container" style={{ padding: '56px 32px', maxWidth: 700 }}>
      <span className="eyebrow">Legal</span>
      <h1 style={{ fontSize: 32, margin: '14px 0 24px' }}>Privacy Policy</h1>

      <p style={{ color: 'var(--slate)', fontSize: 14, marginBottom: 24 }}>
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <div style={{ color: 'var(--slate)', fontSize: 15, lineHeight: 1.8 }}>
        <h2 style={{ fontSize: 19, marginTop: 28, marginBottom: 10, color: 'var(--ink)' }}>Information we collect</h2>
        <p>
          We collect the information you provide when creating an account,
          including your name, email, and — if you sign up as a client —
          your company name and website. Freelancers may add a photo, bio,
          skills, and portfolio work.
        </p>

        <h2 style={{ fontSize: 19, marginTop: 28, marginBottom: 10, color: 'var(--ink)' }}>Veteran verification</h2>
        <p>
          Freelancers verify their military or veteran status through ID.me.
          LanceNest never collects, views, or stores DD-214s or other
          military documents — ID.me confirms status directly and shares
          only the verification result with us.
        </p>

        <h2 style={{ fontSize: 19, marginTop: 28, marginBottom: 10, color: 'var(--ink)' }}>Payments</h2>
        <p>
          All payments are processed by Stripe. LanceNest does not store
          credit card numbers or bank account details — Stripe handles this
          directly under its own privacy and security practices.
        </p>

        <h2 style={{ fontSize: 19, marginTop: 28, marginBottom: 10, color: 'var(--ink)' }}>How we use your information</h2>
        <p>
          We use your information to operate the marketplace: matching
          freelancers and clients, processing payments, sending account and
          transactional emails, and improving the platform.
        </p>

        <h2 style={{ fontSize: 19, marginTop: 28, marginBottom: 10, color: 'var(--ink)' }}>Contact</h2>
        <p>
          Questions about this policy can be sent to the contact information
          listed on our pricing page.
        </p>

        <p style={{ marginTop: 32, padding: 16, background: 'var(--marble-dim)', borderRadius: 8, fontSize: 13 }}>
          This is a general-purpose placeholder policy. It should be reviewed
          by an attorney before LanceNest processes real veteran status data
          or real payments at scale.
        </p>
      </div>
    </main>
  );
}
