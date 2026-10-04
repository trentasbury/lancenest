import { CANONICAL_ORIGIN } from '@/lib/seo';
import type { Metadata, Viewport } from 'next';
import './globals.css';
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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Inter:wght@400;500;600&display=swap"
        />
      </head>
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
