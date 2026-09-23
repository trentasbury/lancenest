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
          <span className="eyebrow">Built for active duty, transitioning, and veteran service members</span>
          <h1>
            The professional network built for those who served.
          </h1>
          <p className="hero-subline">
            Build a profile, connect with others who've served, and find your
            next role — whether you're still in, transitioning out, or years
            past your last duty station.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24, justifyContent: 'center' }}>
            <a href="/signup?role=member" className="btn btn-primary">Join as a service member</a>
            <a href="/signup?role=employer" className="btn btn-outline">I'm hiring veterans</a>
          </div>
        </div>
      </section>

      <Reveal>
        <section className="plain-surface feature-row">
          <div className="feature-row-title">
            <h2>Your record, verified — not just claimed</h2>
            <p>Built on transparency, not subscriptions for members</p>
          </div>
          <div className="feature-grid">
            <div className="feature-item">
              <CheckIcon />
              <h3>Every profile reviewed</h3>
              <p>Service members submit documentation for a real human review before a profile goes live — not a self-reported checkbox.</p>
            </div>
            <div className="feature-item">
              <CheckIcon />
              <h3>A wall for the community</h3>
              <p>Follow people you served with, see career updates and job openings from your network, in one feed built for this community specifically.</p>
            </div>
            <div className="feature-item">
              <CheckIcon />
              <h3>Employers who actually want you</h3>
              <p>Companies and recruiters here are looking specifically for military talent — not sorting you out of a generic applicant pile.</p>
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
              Built by a Marine, for the community that earned it. Whether
              you're chasing a federal role that needs a clearance, or
              starting the next chapter entirely, your service is the
              credential — we built the network around it.
            </p>
          </div>
        </section>
      </Reveal>

      <section className="plain-surface process">
        <span className="eyebrow">How it works</span>
        <div className="process-grid" style={{ marginTop: 40 }}>
          <Reveal className="process-item">
            <span className="process-numeral">I.</span>
            <h3>Build a profile</h3>
            <p>Your service record, your career history, your next move — submitted for verification in minutes.</p>
          </Reveal>
          <Reveal className="process-item">
            <span className="process-numeral">II.</span>
            <h3>Connect and follow</h3>
            <p>Find people you served with, follow companies hiring veterans, see it all on your wall.</p>
          </Reveal>
          <Reveal className="process-item">
            <span className="process-numeral">III.</span>
            <h3>Get hired</h3>
            <p>Apply directly, or let recruiters who are specifically looking for veterans find you.</p>
          </Reveal>
        </div>
      </section>

      <div className="marble-surface">
        <Reveal>
          <section className="statement">
            <span className="eyebrow">Built for the mission</span>
            <h2>Your service opened doors in uniform. <em>It still should now.</em></h2>
          </section>
        </Reveal>

        <Footer />
      </div>
    </main>
  );
}
