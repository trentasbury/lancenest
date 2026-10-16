import { CANONICAL_ORIGIN } from '@/lib/seo';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Fonts are served from our own domain and preloaded (no Google Fonts round trip, no layout shift).
const inter = localFont({
  src: './fonts/inter-latin-wght-normal.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-inter',
});
const cormorant = localFont({
  src: [
    { path: './fonts/cormorant-garamond-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/cormorant-garamond-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/cormorant-garamond-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: './fonts/cormorant-garamond-latin-500-italic.woff2', weight: '500', style: 'italic' },
  ],
  display: 'swap',
  variable: '--font-cormorant',
});
import PageViewBeacon from '@/components/PageViewBeacon';
import AutoCloseDetails from '@/components/AutoCloseDetails';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';


const ORG_JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${CANONICAL_ORIGIN}/#org`, name: 'LanceNest', url: CANONICAL_ORIGIN, logo: `${CANONICAL_ORIGIN}/icon.svg`,
      description: 'Verified career network and hiring platform for U.S. service members, veterans, and employers hiring military talent for federal-ready professional work.', email: 'support@lancenest.com' },
    { '@type': 'WebSite', '@id': `${CANONICAL_ORIGIN}/#website`, name: 'LanceNest', url: CANONICAL_ORIGIN, publisher: { '@id': `${CANONICAL_ORIGIN}/#org` } },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_ORIGIN),
  title: { default: 'LanceNest — Veteran Jobs. Built for What’s Next.', template: '%s — LanceNest' },
  description:
    'LanceNest is the verified career network for active duty, Guard, Reserve, transitioning, and veteran service members — translate your military experience into civilian roles, and hire verified military talent for federal-ready work.',
  icons: { icon: '/icon.svg' },
  openGraph: { siteName: 'LanceNest', type: 'website', locale: 'en_US' },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { themeColor: '#102431' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable}`}>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-ivory focus:p-2">
          Skip to content
        </a>
        <Navbar />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
              <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }} />
        <PageViewBeacon />
        <AutoCloseDetails />
      </body>
    </html>
  );
}
