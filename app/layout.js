import './globals.css';

export const metadata = {
  title: 'LanceNest — Hire independents. Keep it simple.',
  description: 'A freelance marketplace with one flat 10% fee. No subscriptions, no surprises.',
};

function Crest({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="19" stroke="#D4AF37" strokeWidth="1.2" />
      <circle cx="20" cy="20" r="16" stroke="#D4AF37" strokeWidth="0.5" opacity="0.5" />
      <text x="20" y="27" textAnchor="middle" fontFamily="Cormorant Garamond, serif" fontStyle="italic" fontSize="16" fontWeight="600" fill="#D4AF37">LN</text>
    </svg>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <a href="/" className="brand">
            <Crest />
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
