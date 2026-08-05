import Footer from '../components/Footer';
import Reveal from '../components/Reveal';

function Gem() {
  return (
    <svg viewBox="0 0 240 300" width="100%" height="100%" style={{ maxWidth: 220 }}>
      <polygon points="120,20 180,70 160,140 120,290 80,140 60,70" fill="none" stroke="#D4AF37" strokeWidth="1.4" />
      <polygon points="120,20 180,70 120,110 60,70" fill="#D4AF37" opacity="0.08" stroke="#D4AF37" strokeWidth="1" />
      <polygon points="60,70 120,110 100,180 30,140" fill="#D4AF37" opacity="0.05" stroke="#D4AF37" strokeWidth="0.8" />
      <polygon points="180,70 210,140 140,180 120,110" fill="#D4AF37" opacity="0.11" stroke="#D4AF37" strokeWidth="0.8" />
      <polygon points="100,180 120,110 140,180 120,290" fill="#D4AF37" opacity="0.14" stroke="#D4AF37" strokeWidth="0.8" />
      <line x1="120" y1="20" x2="120" y2="110" stroke="#D4AF37" strokeWidth="0.6" opacity="0.5" />
      <line x1="60" y1="70" x2="100" y2="180" stroke="#D4AF37" strokeWidth="0.6" opacity="0.5" />
      <line x1="180" y1="70" x2="140" y2="180" stroke="#D4AF37" strokeWidth="0.6" opacity="0.5" />
    </svg>
  );
}

export default function Home() {
  return (
    <main>
      <section className="photo-hero">
        <div className="marble-bg" />
        <div className="photo-hero-content">
          <span className="eyebrow">A marketplace built on trust</span>
          <h1>
            A home for
            <span className="gold-line">independent work</span>
          </h1>
          <p>
            LanceNest connects clients with vetted freelancers — no subscriptions,
            no bidding wars, no hidden markups. Just a straightforward fee and
            a profile that's actually yours.
          </p>
          <a href="/signup?role=client" className="btn btn-primary">Hire talent</a>
          <a href="/signup?role=freelancer" className="btn btn-outline">Join as a freelancer</a>
        </div>
        <div className="photo-hero-index">
          <span className="active">I</span>
          <span className="rule"></span>
          <span>II</span>
          <span className="rule"></span>
          <span>III</span>
        </div>
      </section>

      <Reveal>
        <section className="welcome">
          <div className="gem-frame">
            <Gem />
          </div>
          <div className="welcome-text">
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

      <section className="process">
        <div className="process-grid">
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
        <section className="statement">
          <span className="eyebrow">Built for the work</span>
          <h2>A profile that's actually yours. <em>Payments that land where they should.</em></h2>
        </section>
      </Reveal>

      <Footer />
    </main>
  );
}
