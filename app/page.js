import Footer from '../components/Footer';
import Reveal from '../components/Reveal';

export default function Home() {
  return (
    <main>
      <section className="search-hero">
        <div className="search-hero-inner">
          <span className="eyebrow">A marketplace built on trust</span>
          <h1>
            Find the right person for your <em>next project</em>
          </h1>

          <form action="/directory" method="get" className="search-bar">
            <input type="text" placeholder="Try 'Shopify developer' or 'brand designer'" />
            <button type="submit">Search</button>
          </form>

          <div className="chip-row">
            <a href="/directory" className="chip">Web design</a>
            <a href="/directory" className="chip">Development</a>
            <a href="/directory" className="chip">Branding</a>
            <a href="/directory" className="chip">Writing</a>
            <a href="/directory" className="chip">Marketing</a>
          </div>
        </div>
      </section>

      <Reveal>
        <section className="logo-row">
          <div className="logo-row-title">
            <h2>A trusted marketplace</h2>
            <p>Built on transparency, not subscriptions</p>
          </div>
          <div className="logo-row-marks">
            <span className="logo-mark">Stripe Secured</span>
            <span className="logo-mark">No Listing Fees</span>
            <span className="logo-mark">Direct Payouts</span>
            <span className="logo-mark">Verified Profiles</span>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="welcome">
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
              <a href="/pricing" style={{ color: 'var(--wood)', textDecoration: 'underline' }}> pricing page</a>.
            </p>
          </div>
        </section>
      </Reveal>

      <section className="process">
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
        <section className="statement">
          <span className="eyebrow">Built for the work</span>
          <h2>A profile that's actually yours. <em>Payments that land where they should.</em></h2>
        </section>
      </Reveal>

      <Footer />
    </main>
  );
}
