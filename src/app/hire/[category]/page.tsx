import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { allPublicServices, categoryFromSlug, categorySlug } from '@/lib/publicServices';
import { CANONICAL_ORIGIN } from '@/lib/seo';
import CategoryList from './CategoryList';

export const revalidate = 600;

export async function generateMetadata(props: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const category = categoryFromSlug((await props.params).category);
  if (!category) return {};
  const any = (await allPublicServices()).some((s) => s.category === category);
  return {
    title: `Veteran ${category.toLowerCase()} pros`,
    description: `Hire verified veterans and military spouses for ${category.toLowerCase()} on LanceNest. Pros never pay lead fees.`,
    alternates: { canonical: `${CANONICAL_ORIGIN}/hire/${categorySlug(category)}` },
    ...(any ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function HireCategory(props: { params: Promise<{ category: string }> }) {
  const category = categoryFromSlug((await props.params).category);
  if (!category) notFound();
  const services = (await allPublicServices()).filter((s) => s.category === category);
  return <CategoryList category={category} services={services} />;
}
