/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Verification documents are uploaded through a server action (Vercel caps request bodies at 4.5 MB).
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
};

export default nextConfig;
