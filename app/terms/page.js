export default function Terms() {
  return (
    <main className="plain-surface container" style={{ padding: '56px 32px', maxWidth: 700 }}>
      <span className="eyebrow">Legal</span>
      <h1 style={{ fontSize: 32, margin: '14px 0 24px' }}>Terms of Service</h1>

      <p style={{ color: 'var(--slate)', fontSize: 14, marginBottom: 24 }}>
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <div style={{ color: 'var(--slate)', fontSize: 15, lineHeight: 1.8 }}>
        <h2 style={{ fontSize: 19, marginTop: 28, marginBottom: 10, color: 'var(--ink)' }}>What LanceNest is</h2>
        <p>
          LanceNest is a marketplace connecting veteran freelancers with
          clients, including federal contractors seeking cleared talent
          (LanceNest Federal) and general freelance and trade work
          (LanceNest Marketplace). LanceNest is operated by Asbury Ventures
          Group LLC.
        </p>

        <h2 style={{ fontSize: 19, marginTop: 28, marginBottom: 10, color: 'var(--ink)' }}>Platform fee</h2>
        <p>
          LanceNest takes a platform fee from the freelancer's side of each
          completed job, as described on our pricing page. Fees are subject
          to change with notice.
        </p>

        <h2 style={{ fontSize: 19, marginTop: 28, marginBottom: 10, color: 'var(--ink)' }}>Veteran verification</h2>
        <p>
          Freelancer accounts require verification of military or veteran
          status through ID.me. Misrepresenting veteran status is grounds
          for account termination.
        </p>

        <h2 style={{ fontSize: 19, marginTop: 28, marginBottom: 10, color: 'var(--ink)' }}>Company review</h2>
        <p>
          Client and company accounts are subject to manual review before
          job postings become publicly visible. LanceNest reserves the right
          to decline or remove any account or posting.
        </p>

        <h2 style={{ fontSize: 19, marginTop: 28, marginBottom: 10, color: 'var(--ink)' }}>Payments</h2>
        <p>
          Payments are processed through Stripe. LanceNest is not a party to
          the underlying work agreement between freelancer and client, and
          does not guarantee the outcome of any project.
        </p>

        <h2 style={{ fontSize: 19, marginTop: 28, marginBottom: 10, color: 'var(--ink)' }}>Limitation of liability</h2>
        <p>
          LanceNest is provided "as is." To the fullest extent permitted by
          law, LanceNest and Asbury Ventures Group LLC are not liable for
          disputes, damages, or losses arising from use of the platform.
        </p>

        <p style={{ marginTop: 32, padding: 16, background: 'var(--marble-dim)', borderRadius: 8, fontSize: 13 }}>
          This is a general-purpose placeholder. It should be reviewed by an
          attorney before LanceNest operates at scale, particularly given
          the handling of veteran status data and federal contract-adjacent
          work.
        </p>
      </div>
    </main>
  );
}
