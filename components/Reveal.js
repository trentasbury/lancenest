function FooterCrest() {
  return (
    <svg width="28" height="28" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="19" stroke="#C6A15B" strokeWidth="1" />
      <circle cx="20" cy="20" r="16" stroke="#C6A15B" strokeWidth="0.5" opacity="0.5" />
      <text x="20" y="26" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="15" fontWeight="600" fill="#0E0E10">LN</text>
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <FooterCrest />
          <span className="footer-tag">LanceNest — Est. 2026</span>
        </div>
        <div className="footer-links">
          <a href="/directory">Find talent</a>
          <a href="/signup?role=freelancer">Join as a freelancer</a>
          <a href="/login">Log in</a>
        </div>
      </div>
      <div className="footer-bottom container">
        © {new Date().getFullYear()} LanceNest. One flat 10% fee. No subscriptions, no surprises.
      </div>
    </footer>
  );
}
