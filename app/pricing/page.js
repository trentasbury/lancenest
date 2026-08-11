export default function Pricing() {
  return (
    <main className="plain-surface container" style={{ padding: '72px 32px', maxWidth: 680 }}>
      <span className="eyebrow">Pricing</span>
      <h1 style={{ fontSize: 38, margin: '16px 0 8px' }}>How LanceNest is paid for.</h1>
      <p style={{ color: 'var(--slate)', marginBottom: 40 }}>
        Freelancers get the friendly rates. Buyers pay like they would for any staffing or recruiting service — still well below a traditional GovCon staffing agency.
      </p>

      <h2 style={{ fontSize: 24, marginBottom: 16 }}>For freelancers</h2>

      <section style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 19, marginBottom: 8 }}>Standard — 15% per project</h3>
        <p style={{ color: 'var(--slate)', fontSize: 15, lineHeight: 1.8 }}>
          Every veteran freelancer starts here, no subscription required. LanceNest takes 15% from your side of each completed job. No listing fee, no fee to create a profile.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 19, marginBottom: 8 }}>Pro — 10% per project + $19/month</h3>
        <p style={{ color: 'var(--slate)', fontSize: 15, lineHeight: 1.8 }}>
          Lowers the platform fee to 10%, adds priority placement and a Pro badge. Pays for itself on your first $380 of monthly work.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h3 style={{ fontSize: 19, marginBottom: 8 }}>Federal Pro — 8% per project + $29/month</h3>
        <p style={{ color: 'var(--slate)', fontSize: 15, lineHeight: 1.8 }}>
          Built for freelancers regularly taking on higher-value federal contract work, where a flat 15% adds up fast. On a $15,000 engagement, Federal Pro's 8% fee is $1,200 instead of $2,250 at Standard.
        </p>
      </section>

      <section style={{ marginBottom: 48, padding: 20, background: 'var(--marble-dim)', borderRadius: 10 }}>
        <p style={{ fontSize: 14 }}>
          <strong>Founding 20:</strong> the first 20 verified freelancers pay just 5% for six months. <a href="/#founding" style={{ color: 'var(--wood)', textDecoration: 'underline' }}>See if spots are still open →</a>
        </p>
      </section>

      <h2 style={{ fontSize: 24, marginBottom: 16 }}>For companies hiring</h2>

      <section style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 19, marginBottom: 8 }}>Standard hiring — 5% service fee</h3>
        <p style={{ color: 'var(--slate)', fontSize: 15, lineHeight: 1.8 }}>
          Added on top of the invoice when you hire and pay a freelancer through LanceNest. On a $1,000 job, you're charged $1,050.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 19, marginBottom: 8 }}>Retained shortlist — $500</h3>
        <p style={{ color: 'var(--slate)', fontSize: 15, lineHeight: 1.8 }}>
          A guaranteed shortlist of three verified candidates within 72 hours. Fully credited against your first engagement.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 19, marginBottom: 8 }}>Federal Employer — $249/month</h3>
        <p style={{ color: 'var(--slate)', fontSize: 15, lineHeight: 1.8 }}>
          Unlimited bench search, direct contact with any freelancer, and the ability to post requirements. Built for companies hiring veteran talent repeatedly.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h3 style={{ fontSize: 19, marginBottom: 8 }}>Trade & booking deposits</h3>
        <p style={{ color: 'var(--slate)', fontSize: 15, lineHeight: 1.8 }}>
          For trade work (HVAC, electrical, and similar), a 20% deposit confirms the booking and unlocks direct contact. The platform fee is collected from the deposit; the balance is paid directly to your pro.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>Payments</h2>
        <p style={{ color: 'var(--slate)', fontSize: 15.5, lineHeight: 1.8 }}>
          All payments are processed through Stripe. Freelancers connect a Stripe account to receive payouts directly to their bank. LanceNest never holds client or freelancer funds directly.
        </p>
      </section>
    </main>
  );
}
