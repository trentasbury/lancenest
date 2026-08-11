import Footer from '../components/Footer';
import Reveal from '../components/Reveal';
import ConciergeForm from '../components/ConciergeForm';
import FoundingBanner from '../components/FoundingBanner';

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
          <span className="eyebrow">Veteran-owned · Federal-grade verification</span>
          <h1>
            Veteran talent for <em>federal missions.</em>
          </h1>
          <p className="hero-subline">
            Every freelancer on LanceNest is service-verified through ID.me —
            not just claimed as "vetted." LanceNest Federal connects cleared
            veterans to federal contractors who need surge talent.
            LanceNest Marketplace opens the same verified pool to any veteran
            freelancing in any trade, from IT to HVAC.
          </p>
        </div>
      </section>

      <Reveal>
        <section className="plain-surface" style={{ padding: '70px 40px' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <span className="eyebrow">Tell us what you need</span>
            <h2 style={{ fontSize: 28, margin: '10px 0 8px' }}>
              We'll hand you a shortlist. You pick.
            </h2>
            <p style={{ color: 'var(--slate)', maxWidth: 460, margin: '0 auto' }}>
              Describe the work — we return three verified, service-matched candidates within 48 hours.
            </p>
          </div>
          <ConciergeForm />
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13 }}>
            Prefer to browse yourself? <a href="/directory" style={{ color: 'var(--wood)', textDecoration: 'underline' }}>See the directory →</a>
          </p>
        </section>
      </Reveal>

      <Reveal>
        <section className="plain-surface feature-row">
          <div className="feature-row-title">
            <h2>The one claim competitors can't copy</h2>
            <p>Not "vetted." Verified.</p>
          </div>
          <div className="feature-grid">
            <div className="feature-item">
              <CheckIcon />
              <h3>ID.me service verification</h3>
              <p>Every freelancer confirms military or veteran status through ID.me — no forged documents, no self-reported claims.</p>
            </div>
            <div className="feature-item">
              <CheckIcon />
              <h3>Companies, reviewed too</h3>
              <p>Every company hiring on LanceNest is manually reviewed before their job posts go public — not just anyone can post.</p>
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
        <section className="plain-surface founder-section">
          <div className="founder-photo" />
          <div>
            <span className="eyebrow">Built by a Marine</span>
            <h3>Trent Asbury, Founder</h3>
            <p>
              U.S. Marine Corps veteran. Built LanceNest because the same
              clearance and service record that opened doors in uniform
              should still count for something in civilian contract work —
              not get buried in a resume no one reads.
            </p>
          </div>
        </section>
      </Reveal>

      <FoundingBanner />

      <section className="plain-surface process">
        <span className="eyebrow">How it works</span>
        <div className="process-grid" style={{ marginTop: 40 }}>
          <Reveal className="process-item">
            <span className="process-numeral">I.</span>
            <h3>Verify & build a profile</h3>
            <p>Confirm your veteran status through ID.me, list your clearance level if applicable, and set your rate.</p>
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
