import './globals.css';
import NavBar from '../components/NavBar';
import ChatWidget from '../components/ChatWidget';

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
        <ChatWidget />
      </body>
    </html>
  );
}
