import { requireRole } from '@/lib/auth';

export default async function VeteranLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['veteran'], '/dashboard');
  return <>{children}</>;
}
