import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { allPublicServices, categoryFromSlug, categorySlug } from '@/lib/publicServices';
import { CANONICAL_ORIGIN } from '@/lib/seo';
import { stateOf } from '@/lib/place';
import CategoryList from '../CategoryList';

export const revalidate = 600;

async function load(params: Promise<{ category: string; state: string }>) {
  const p = await params;
  const category = categoryFromSlug(p.category);
  const st = /^[a-z]{2}$/.test(p.state) ? stateOf(p.state) : null;
  return { category, st };
}

export async function generateMetadata(props: { params: Promise<{ category: string; state: string }> }): Promise<Metadata> {
  const { category, st } = await load(props.params);
  if (!category || !st) return {};
  const any = (await allPublicServices()).some((s) => s.category === category && s.state === st[0]);
  return {
    title: `Veteran ${category.toLowerCase()} pros in ${st[1]}`,
    description: `Hire verified veterans and military spouses for ${category.toLowerCase()} in ${st[1]} on LanceNest. Pros never pay lead fees.`,
    alternates: { canonical: `${CANONICAL_ORIGIN}/hire/${categorySlug(category)}/${st[0].toLowerCase()}` },
    ...(any ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function HireCategoryState(props: { params: Promise<{ category: string; state: string }> }) {
  const { category, st } = await load(props.params);
  if (!category || !st) notFound();
  const services = (await allPublicServices()).filter((s) => s.category === category);
  return <CategoryList category={category} services={services} state={st[0]} />;
}
