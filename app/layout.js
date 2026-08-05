import './globals.css';

export const metadata = {
  title: 'LanceNest — Hire independents. Keep it simple.',
  description: 'A freelance marketplace with one flat 10% fee. No subscriptions, no surprises.',
};

function Logo() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 21 Q16 9 29 21" stroke="#A9822A" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M7 23 Q16 15 25 23" stroke="#A9822A" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="16" cy="17" r="2.4" fill="#A9822A" />
    </svg>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="pill-nav-wrap">
          <a href="/" className="brand" style={{ gap: 8 }}>
            <Logo />
            <span className="wordmark" style={{ color: 'var(--ink)', fontSize: 20 }}>LanceNest</span>
          </a>
          <div className="pill-nav-links">
            <a href="/directory">Find talent</a>
            <a href="/login">Log in</a>
          </div>
          <a href="/signup" className="pill-btn" style={{ padding: '13px 22px' }}>Sign up</a>
        </div>
        {children}
      </body>
    </html>
  );
}
