import { requireVerifiedMember } from '@/lib/auth';

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireVerifiedMember('/jobs');
  return <>{children}</>;
}
