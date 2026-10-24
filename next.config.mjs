/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';
// LanceNest's own Supabase project only (a wildcard would let anyone's Supabase files through the image optimizer).
const supabaseHost = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname; } catch { return 'ugjdzruswfzdiskvetvy.supabase.co'; } })();

// Where the site is allowed to load things from. Anything else is blocked by the browser.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  `img-src 'self' data: blob: https://${supabaseHost}`,
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://challenges.cloudflare.com`,
  "frame-src https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com https://connect.stripe.com",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Verification documents are uploaded through a server action (Vercel caps request bodies at 4.5 MB).
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: supabaseHost }],
    dangerouslyAllowSVG: false,
  },
  async redirects() {
    // Old site URLs still in search results
    return [{ source: '/directory', destination: '/careers', permanent: true }, { source: '/freelancers', destination: '/careers', permanent: true }, { source: '/pricing', destination: '/employers', permanent: false }, { source: '/verification', destination: '/trust', permanent: true }, { source: '/employers/pricing', destination: '/employers', permanent: false },
      // The default Vercel address shows the same site: send visitors and search engines to the real domain.
      { source: '/:path*', has: [{ type: 'host', value: 'lancenest.vercel.app' }], destination: 'https://www.lancenest.com/:path*', permanent: true },
      // Career translator: one pre-built page per branch (was ?branch=).
      { source: '/careers/army', destination: '/careers', permanent: true },
      { source: '/careers', has: [{ type: 'query', key: 'branch', value: '(?<branch>marine-corps|navy|air-force|space-force|coast-guard)' }], destination: '/careers/:branch', permanent: true }];
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
