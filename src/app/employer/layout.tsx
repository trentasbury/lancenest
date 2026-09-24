import { requireRole } from '@/lib/auth';

export default async function EmployerLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['employer'], '/employer/dashboard');
  return <>{children}</>;
}
