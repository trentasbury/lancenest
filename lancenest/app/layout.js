import './globals.css';

export const metadata = {
  title: 'Lancenest — Hire independents. Keep it simple.',
  description: 'A freelance marketplace with one flat 10% fee. No subscriptions, no surprises.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <a href="/" className="wordmark">Lance<span>nest</span></a>
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
