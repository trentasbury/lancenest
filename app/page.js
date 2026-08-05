import Footer from '../components/Footer';
import Reveal from '../components/Reveal';

export default function Home() {
  return (
    <main>
      <section className="stone marble-hero">
        <div className="marble-hero-inner">
          <div>
            <span className="eyebrow">A marketplace built on trust</span>
            <h1>
              <span className="line-gold">Independent</span>
              <span className="line-white">Work, Done Right</span>
            </h1>
            <p>
              LanceNest connects clients with vetted freelancers — no subscriptions,
              no bidding wars, no hidden markups. Just a straightforward fee and
              a profile that's actually yours.
            </p>
            <a href="/directory" className="pill-btn">Find talent →</a>
          </div>

          <div className="quote-card">
            <span className="eyebrow">Get started</span>
            <h3>Join LanceNest today</h3>
            <div className="quote-card-toggle">
              <a href="/signup?role=client">I'm hiring</a>
              <a href="/signup?role=freelancer">I'm a freelancer</a>
            </div>
            <a href="/signup" className="pill-btn">Create account</a>
          </div>
        </div>
      </section>

      <Reveal>
        <section className="stone-light logo-row">
          <div className="logo-row-title">
            <h2>A trusted marketplace</h2>
            <p>Built on transparency, not subscriptions</p>
          </div>
          <div className="logo-row-marks">
            <span className="logo-mark">Flat 10% Fee</span>
            <span className="logo-mark">Stripe Secured</span>
            <span className="logo-mark">No Listing Fees</span>
            <span className="logo-mark">Direct Payouts</span>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="stone-light welcome">
          <div className="welcome-inner">
            <span className="eyebrow">Welcome to</span>
            <h2>LanceNest</h2>
            <p>
              A home base for independent work — built for people who'd rather
              spend their energy on the craft than on chasing invoices.
            </p>
            <p>
              Every profile is yours to keep, and every payment moves straight
              to your bank. Our full fee structure is always visible on our
              <a href="/pricing" style={{ color: 'var(--gold-deep)', textDecoration: 'underline' }}> pricing page</a>.
            </p>
          </div>
        </section>
      </Reveal>

      <section className="stone-light process">
        <span className="eyebrow">How it works</span>
        <div className="process-grid" style={{ marginTop: 40 }}>
          <Reveal className="process-item">
            <span className="process-numeral">I.</span>
            <h3>Build a profile</h3>
            <p>Portfolio, skills, and rate — live in minutes.</p>
          </Reveal>
          <Reveal className="process-item">
            <span className="process-numeral">II.</span>
            <h3>Get hired</h3>
            <p>Clients find you in the public directory or message you directly.</p>
          </Reveal>
          <Reveal className="process-item">
            <span className="process-numeral">III.</span>
            <h3>Get paid</h3>
            <p>Client pays through LanceNest, straight to your bank.</p>
          </Reveal>
        </div>
      </section>

      <Reveal>
        <section className="stone statement">
          <span className="eyebrow">Built for the work</span>
          <h2>A profile that's actually yours. <em>Payments that land where they should.</em></h2>
        </section>
      </Reveal>

      <div className="stone">
        <Footer />
      </div>
    </main>
  );
}
