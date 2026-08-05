export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="container">
          <div className="rate-badge"><span className="dot"></span> One flat 10% fee. Nothing else.</div>
          <h1>A home base for your freelance work.</h1>
          <p>
            Lancenest connects clients with vetted freelancers. No subscriptions,
            no bidding wars, no hidden markups — just a single 10% fee taken when
            a job is paid out, and a profile that's actually yours.
          </p>
          <a href="/signup?role=client" className="btn btn-primary" style={{ marginRight: 12 }}>
            Hire talent
          </a>
          <a href="/signup?role=freelancer" className="btn btn-outline">
            Join as a freelancer
          </a>
        </div>
      </section>

      <section className="container" style={{ padding: '48px 24px' }}>
        <div className="grid" style={{ padding: 0, gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="card">
            <h3>1. Build a profile</h3>
            <p className="meta">Portfolio, skills, and rate — live in minutes.</p>
          </div>
          <div className="card">
            <h3>2. Get hired</h3>
            <p className="meta">Clients find you in the public directory or message you directly.</p>
          </div>
          <div className="card">
            <h3>3. Get paid</h3>
            <p className="meta">Client pays through Lancenest. We take 10%, you keep the rest — paid straight to your bank.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
