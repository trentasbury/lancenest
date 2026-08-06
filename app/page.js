import Footer from '../components/Footer';
import Reveal from '../components/Reveal';

function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#8A5A34" strokeWidth="1.4" />
      <path d="M8 12.5L10.5 15L16 9" stroke="#8A5A34" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  return (
    <main>
      <section className="marble-surface search-hero">
        <div className="search-hero-inner">
          <span className="eyebrow">Trusted freelancers for web design, branding & Shopify</span>
          <h1>
            Hire vetted freelancers for your <em>next launch</em>
          </h1>
          <p className="hero-subline">
            Every freelancer vetted for quality, communication, and transparency —
            no bidding wars, no hidden fees.
          </p>

          <form action="/directory" method="get" className="search-bar">
            <input type="text" name="q" placeholder="Try 'Shopify developer', 'brand designer', or 'local SEO'" />
            <button type="submit">Search</button>
          </form>

          <div className="chip-row">
            <a href="/directory" className="chip">Web design & UX</a>
            <a href="/directory" className="chip">Branding & identity</a>
            <a href="/directory" className="chip">Shopify & ecommerce</a>
            <a href="/directory" className="chip chip-muted">More categories →</a>
          </div>

          <p className="hero-trust-line">Vetted freelancers · Secure payments · Clear project scopes</p>
          <p className="hero-audience-line">Designed for founders, agencies, and local service businesses.</p>
        </div>
      </section>

      <Reveal>
        <section className="plain-surface feature-row">
          <div className="feature-row-title">
            <h2>Why LanceNest</h2>
            <p>Built on transparency, designed for trust</p>
          </div>
          <div className="feature-grid">
            <div className="feature-item">
              <CheckIcon />
              <h3>Stripe secured</h3>
              <p>Every payment is processed and protected through Stripe — we never hold your funds.</p>
            </div>
            <div className="feature-item">
              <CheckIcon />
              <h3>No listing fees</h3>
              <p>Creating a profile, applying, and browsing the directory costs nothing.</p>
            </div>
            <div className="feature-item">
              <CheckIcon />
              <h3>Direct payouts</h3>
              <p>Money moves straight from client to freelancer's bank — no holding period.</p>
            </div>
          </div>
        </section>
      </Reveal>

      <hr className="section-divider" />

      <Reveal>
        <section className="plain-surface welcome">
          <div className="welcome-inner">
            <span className="eyebrow">Welcome to</span>
            <h2>LanceNest</h2>
            <p>
              Your nest for reliable talent and long-term partnerships — built
              for people who'd rather
              spend their energy on the craft than on chasing invoices.
            </p>
            <p>
              Every profile is yours to keep. Our full fee structure is always
              visible on our
              <a href="/pricing" style={{ color: 'var(--wood)', textDecoration: 'underline' }}> pricing page</a>.
            </p>
          </div>
        </section>
      </Reveal>

      <hr className="section-divider" />

      <section className="plain-surface process">
        <span className="eyebrow">How it works</span>
        <div className="process-grid" style={{ marginTop: 48 }}>
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

      <div className="marble-surface">
        <Reveal>
          <section className="statement">
            <span className="eyebrow">Built for the work</span>
            <h2>A profile that's actually yours. <em>Payments that land where they should.</em></h2>
          </section>
        </Reveal>

        <Footer />
      </div>
    </main>
  );
}
