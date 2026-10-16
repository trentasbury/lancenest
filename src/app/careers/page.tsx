import type { Metadata } from 'next';
import CareersBrowser from '@/components/careers/CareersBrowser';

// Pre-built and served from the location nearest each visitor; refreshed daily.
export const revalidate = 86400;

export const metadata: Metadata = { alternates: { canonical: '/careers' }, title: 'Military to civilian careers: every MOS, rating, and AFSC', description: 'Civilian career translations for 1,469 Army, Marine Corps, Navy, Air Force, Space Force, and Coast Guard jobs.' };

export default function CareersIndex() {
  return <CareersBrowser branch="Army" />;
}
