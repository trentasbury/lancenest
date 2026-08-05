import './globals.css';

export const metadata = {
  title: 'LanceNest — Hire independents. Keep it simple.',
  description: 'A freelance marketplace with one flat 10% fee. No subscriptions, no surprises.',
};

function Logo({ size = 26 }) {
  return (
    <svg className="crest" width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 21 Q16 9 29 21" stroke="#D4AF37" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M7 23 Q16 15 25 23" stroke="#D4AF37" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="16" cy="17" r="2.4" fill="#D4AF37" />
    </svg>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <a href="/" className="brand">
            <Logo />
            <span className="wordmark">LanceNest</span>
          </a>
          <div className="nav-links">
            <a href="/directory">Find talent</a>
            <a href="/login">Log in</a>
            <a href="/signup" className="btn btn-primary">Sign up</a>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
