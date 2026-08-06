import './globals.css';
import NavBar from '../components/NavBar';

export const metadata = {
  title: 'LanceNest — Hire independents. Keep it simple.',
  description: 'A freelance marketplace with transparent, flat fees. No hidden markups.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
