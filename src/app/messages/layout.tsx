import { requireFreelanceAccess } from '@/lib/auth';

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireFreelanceAccess('/messages');
  return <>{children}</>;
}
