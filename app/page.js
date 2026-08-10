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
          <span className="eyebrow">Veteran-owned · Cleared talent, first</span>
          <h1>
            Your clearance is the credential. <em>We built the marketplace around it.</em>
          </h1>
          <p className="hero-subline">
            LanceNest Federal connects cleared veterans with federal contractors who
            need surge talent — verified by DD-214 and clearance status. Below that,
            LanceNest Marketplace is open to every veteran for everyday freelance
            work, from web design to HVAC.
          </p>

          <form action="/directory" method="get" className="search-bar">
            <input type="text" name="q" placeholder="Try 'cleared IT support', 'web design', or 'HVAC tech'" />
            <button type="submit">Search</button>
          </form>

          <div className="chip-row">
            <a href="/directory" className="chip">Security clearance</a>
            <a href="/directory" className="chip">Federal & IT</a>
            <a href="/directory" className="chip">Web design</a>
            <a href="/directory" className="chip">HVAC & trades</a>
            <a href="/directory" className="chip">Electrical</a>
            <a href="/directory" className="chip chip-muted">Browse all →</a>
          </div>
          <p style={{ fontSize: 12, color: 'var(--slate-light)', marginTop: 6 }}>
            Verified veterans only. Every skill, every trade — if you served, this is built for you.
          </p>
        </div>
      </section>

      <Reveal>
        <section className="plain-surface feature-row">
          <div className="feature-row-title">
            <h2>Two tiers, one mission</h2>
            <p>Veteran-owned. Built on transparency, not subscriptions</p>
          </div>
          <div className="feature-grid">
            <div className="feature-item">
              <CheckIcon />
              <h3>LanceNest Federal</h3>
              <p>The flagship. Verified veteran surge talent for federal contractors — cleared roles, DD-214 verification, and a marketplace built around security clearance as the credential that matters.</p>
            </div>
            <div className="feature-item">
              <CheckIcon />
              <h3>LanceNest Marketplace</h3>
              <p>Open to every veteran, cleared or not. Web design, HVAC, electrical, writing, consulting — build a freelance business in whatever trade you know.</p>
            </div>
            <div className="feature-item">
              <CheckIcon />
              <h3>Stripe secured</h3>
              <p>Every payment is processed and protected through Stripe — we never hold your funds.</p>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="plain-surface welcome">
          <div className="welcome-inner">
            <span className="eyebrow">Welcome to</span>
            <h2>LanceNest</h2>
            <p>
              Built by a Marine, for the community that earned it. LanceNest
              Federal leads — a marketplace where your clearance is verified
              and valued, matching cleared veterans to the federal contractors
              who need them most.
            </p>
            <p>
              LanceNest Marketplace sits underneath it, open to any veteran
              freelancing in any trade. Every profile is yours to keep. Our
              full fee structure is always visible on our
              <a href="/pricing" style={{ color: 'var(--wood)', textDecoration: 'underline' }}> pricing page</a>.
            </p>
          </div>
        </section>
      </Reveal>

      <section className="plain-surface process">
        <span className="eyebrow">How it works</span>
        <div className="process-grid" style={{ marginTop: 40 }}>
          <Reveal className="process-item">
            <span className="process-numeral">I.</span>
            <h3>Verify & build a profile</h3>
            <p>Confirm your veteran status, list your clearance level if applicable, and set your rate.</p>
          </Reveal>
          <Reveal className="process-item">
            <span className="process-numeral">II.</span>
            <h3>Get hired</h3>
            <p>Federal contractors and everyday clients find you in the directory or message you directly.</p>
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
            <h2>Your clearance opened doors in uniform. <em>It still should now.</em></h2>
          </section>
        </Reveal>

        <Footer />
      </div>
    </main>
  );
}
