function FooterLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 21 Q16 9 29 21" stroke="#8A5A34" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M7 23 Q16 15 25 23" stroke="#8A5A34" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="16" cy="17" r="2.4" fill="#8A5A34" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <FooterLogo />
          <span className="wordmark" style={{ fontSize: 20 }}>LanceNest</span>
        </div>
        <div className="footer-links">
          <a href="/directory">Find talent</a>
          <a href="/listings">Jobs</a>
          <a href="/pricing">Pricing</a>
        </div>
        <div className="footer-bottom">
          © {new Date().getFullYear()} LanceNest
        </div>
      </div>
    </footer>
  );
}
