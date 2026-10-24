import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CareersBrowser from '@/components/careers/CareersBrowser';
import { BRANCH_SLUGS, branchFromSlug } from '@/lib/careers';

// One pre-built page per branch, served from the location nearest each visitor; refreshed daily.
export const revalidate = 86400;

export function generateStaticParams() {
  // Army lives at /careers (next.config redirects /careers/army there).
  return BRANCH_SLUGS.filter(([branch]) => branch !== 'army').map(([branch]) => ({ branch }));
}

export async function generateMetadata(props: { params: Promise<{ branch: string }> }): Promise<Metadata> {
  const params = await props.params;
  const branch = branchFromSlug(params.branch);
  return {
    title: `${branch ?? 'Military'} jobs translated to civilian careers`,
    description: `Civilian career translations for every ${branch ?? 'military'} job code, with the skills and roles each one prepares you for.`,
    alternates: { canonical: `/careers/${params.branch}` },
  };
}

export default async function BranchCareers(props: { params: Promise<{ branch: string }> }) {
  const params = await props.params;
  const branch = branchFromSlug(params.branch);
  if (!branch) notFound();
  return <CareersBrowser branch={branch} />;
}
