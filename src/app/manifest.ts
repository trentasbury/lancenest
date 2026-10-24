import type { MetadataRoute } from 'next';

/** Makes LanceNest installable as an app (Add to Home Screen / Install) on phones and computers. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LanceNest',
    short_name: 'LanceNest',
    description: 'The verified career network for service members, veterans and military spouses.',
    id: '/',
    start_url: '/dashboard?source=app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f7f4ec',
    theme_color: '#102431',
    categories: ['business', 'social', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Jobs', url: '/jobs', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Messages', url: '/messages', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Notifications', url: '/notifications', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
