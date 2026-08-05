import './globals.css';

export const metadata = {
  title: 'LanceNest — Hire independents. Keep it simple.',
  description: 'A freelance marketplace with one flat 10% fee. No subscriptions, no surprises.',
};

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 21 Q16 9 29 21" stroke="#8A5A34" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M7 23 Q16 15 25 23" stroke="#8A5A34" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="16" cy="17" r="2.4" fill="#8A5A34" />
    </svg>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="marble-surface">
        <div className="nav-overlay">
          <div className="nav-overlay-inner">
            <a href="/" className="brand">
              <Logo />
              <span className="wordmark">LanceNest</span>
            </a>
            <div className="nav-links-plain">
              <a href="/directory">Find talent</a>
              <a href="/login">Log in</a>
            </div>
            <a href="/signup" className="wood-pill">Sign up</a>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
