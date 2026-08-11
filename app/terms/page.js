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
          (LanceNest Marketplace). LanceNest is operated by Ossa LLC.
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

        <h2 style={{ fontSize: 19, marginTop: 28, marginBottom: 10, color: 'var(--ink)' }}>Non-circumvention</h2>
        <p>
          Clients agree not to solicit, hire, or pay a freelancer they were
          introduced to through LanceNest outside the platform for a period
          of 12 months following introduction, except by paying LanceNest a
          buyout fee of $2,500 per freelancer. This clause protects the
          verified job history and payment protection LanceNest provides to
          freelancers.
        </p>

        <h2 style={{ fontSize: 19, marginTop: 28, marginBottom: 10, color: 'var(--ink)' }}>Placement / conversion fee</h2>
        <p>
          If a client hires a LanceNest freelancer for a full-time or
          long-term position as a result of an introduction made through the
          platform, the client agrees to pay LanceNest a placement fee equal
          to the greater of $5,000 or 15% of the freelancer's first-year
          compensation. This fee decreases on a straight-line basis over the
          12 months following introduction.
        </p>

        <h2 style={{ fontSize: 19, marginTop: 28, marginBottom: 10, color: 'var(--ink)' }}>Off-platform communication</h2>
        <p>
          Sharing contact information or negotiating payment outside
          LanceNest prior to a confirmed booking or deposit is discouraged
          and may be logged for platform integrity purposes. Off-platform
          transactions are not covered by LanceNest's payment protection or
          dispute process.
        </p>

        <h2 style={{ fontSize: 19, marginTop: 28, marginBottom: 10, color: 'var(--ink)' }}>Limitation of liability</h2>
        <p>
          LanceNest is provided "as is." To the fullest extent permitted by
          law, LanceNest and Ossa LLC are not liable for
          disputes, damages, or losses arising from use of the platform.
        </p>

        <p style={{ marginTop: 32, padding: 16, background: 'var(--marble-dim)', borderRadius: 8, fontSize: 13 }}>
          This is a general-purpose placeholder. The Non-circumvention and
          Placement/conversion fee clauses above are the two most likely to
          be contested by a buyer and should get a flat-fee attorney review
          (roughly $500–1,000) before public launch. The rest is reasonable
          to operate on as written, but full review is still recommended
          before LanceNest operates at scale, particularly given veteran
          status data and federal contract-adjacent work.
        </p>
      </div>
    </main>
  );
}
