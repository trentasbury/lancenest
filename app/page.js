import Footer from '../components/Footer';
import Reveal from '../components/Reveal';

function Gem() {
  return (
    <svg viewBox="0 0 240 300" width="100%" height="100%" style={{ maxWidth: 200 }}>
      <polygon points="120,20 180,70 160,140 120,290 80,140 60,70" fill="none" stroke="#D4AF37" strokeWidth="1.4" />
      <polygon points="120,20 180,70 120,110 60,70" fill="#D4AF37" opacity="0.1" stroke="#D4AF37" strokeWidth="1" />
      <polygon points="60,70 120,110 100,180 30,140" fill="#D4AF37" opacity="0.06" stroke="#D4AF37" strokeWidth="0.8" />
      <polygon points="180,70 210,140 140,180 120,110" fill="#D4AF37" opacity="0.13" stroke="#D4AF37" strokeWidth="0.8" />
      <polygon points="100,180 120,110 140,180 120,290" fill="#D4AF37" opacity="0.16" stroke="#D4AF37" strokeWidth="0.8" />
      <line x1="120" y1="20" x2="120" y2="110" stroke="#D4AF37" strokeWidth="0.6" opacity="0.5" />
      <line x1="60" y1="70" x2="100" y2="180" stroke="#D4AF37" strokeWidth="0.6" opacity="0.5" />
      <line x1="180" y1="70" x2="140" y2="180" stroke="#D4AF37" strokeWidth="0.6" opacity="0.5" />
    </svg>
  );
}

function SpinBadge() {
  return (
    <div className="spin-badge">
      <svg viewBox="0 0 100 100">
        <defs>
          <path id="circlePath" d="M 50, 50 m -38, 0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
        </defs>
        <text fontFamily="IBM Plex Mono, monospace" fontSize="7.2" letterSpacing="1.5" fill="#0A0A0A">
          <textPath href="#circlePath">
            ONE FLAT FEE · TEN PERCENT · ONE FLAT FEE · TEN PERCENT ·
          </textPath>
        </text>
      </svg>
      <div className="arrow">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M7 17L17 7M17 7H9M17 7V15" stroke="#0A0A0A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main>
      <section className="split-hero">
        <div className="split-hero-grid">
          <div className="split-hero-left">
            <span className="eyebrow">A marketplace built on trust</span>
            <h1>A home for independent work.</h1>
            <p>
              LanceNest connects clients with vetted freelancers — no subscriptions,
              no bidding wars, no hidden markups. Just a straightforward fee and
              a profile that's actually yours.
            </p>
            <a href="/signup?role=client" className="pill-btn">Hire talent →</a>
            <SpinBadge />
          </div>
          <div className="split-hero-image stone">
            <Gem />
          </div>
        </div>
      </section>

      <div className="stone-light trust-bar" style={{ marginTop: 60 }}>
        <div className="trust-bar-inner">
          <div className="trust-item" style={{ color: 'var(--body-light)' }}>
            <strong>10%</strong>Flat platform fee
          </div>
          <div className="trust-item" style={{ color: 'var(--body-light)' }}>
            <strong>0</strong>Listing or profile fees
          </div>
          <div className="trust-item" style={{ color: 'var(--body-light)' }}>
            <strong>100%</strong>Yours — profile, portfolio, payouts
          </div>
        </div>
      </div>

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
