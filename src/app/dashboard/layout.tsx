import { requireRole } from '@/lib/auth';

export default async function VeteranLayout({ children }: { children: React.ReactNode }) {
  // Service members, plus the founder's admin account (which also has a member profile).
  await requireRole(['veteran', 'admin'], '/dashboard');
  return <>{children}</>;
}
