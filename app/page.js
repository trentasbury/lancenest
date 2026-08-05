import Footer from '../components/Footer';
import Reveal from '../components/Reveal';

function HeroCrest() {
  return (
    <svg width="56" height="56" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="hero-crest">
      <circle cx="20" cy="20" r="19" stroke="#C6A15B" strokeWidth="1" />
      <circle cx="20" cy="20" r="16" stroke="#C6A15B" strokeWidth="0.5" opacity="0.5" />
      <text x="20" y="26" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="15" fontWeight="600" fill="#0E0E10">LN</text>
    </svg>
  );
}

function StatementCrest() {
  return (
    <svg width="44" height="44" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="crest">
      <circle cx="20" cy="20" r="19" stroke="#C6A15B" strokeWidth="1" />
      <circle cx="20" cy="20" r="16" stroke="#C6A15B" strokeWidth="0.5" opacity="0.5" />
      <text x="20" y="26" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="15" fontWeight="600" fill="#F6F3EC">LN</text>
    </svg>
  );
}

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="container">
          <HeroCrest />
          <div className="eyebrow">One flat fee · Ten percent</div>
          <h1>A home base for your freelance work.</h1>
          <p>
            LanceNest connects clients with vetted freelancers. No subscriptions,
            no bidding wars, no hidden markups — just a single 10% fee taken when
            a job is paid out, and a profile that's actually yours.
          </p>
          <a href="/signup?role=client" className="btn btn-primary">Hire talent</a>
          <a href="/signup?role=freelancer" className="btn btn-outline">Join as a freelancer</a>
        </div>
      </section>

      <section className="process">
        <div className="process-grid">
          <Reveal className="process-item">
            <span className="process-numeral">I</span>
            <h3>Build a profile</h3>
            <p>Portfolio, skills, and rate — live in minutes.</p>
          </Reveal>
          <Reveal className="process-item">
            <span className="process-numeral">II</span>
            <h3>Get hired</h3>
            <p>Clients find you in the public directory or message you directly.</p>
          </Reveal>
          <Reveal className="process-item">
            <span className="process-numeral">III</span>
            <h3>Get paid</h3>
            <p>Client pays through LanceNest. We take 10%, you keep the rest — paid straight to your bank.</p>
          </Reveal>
        </div>
      </section>

      <Reveal>
        <section className="statement">
          <StatementCrest />
          <div className="eyebrow">The difference</div>
          <h2>Most platforms take a cut of your work. <em>We take a fraction, and give you the rest of the room.</em></h2>
        </section>
      </Reveal>

      <Footer />
    </main>
  );
}
