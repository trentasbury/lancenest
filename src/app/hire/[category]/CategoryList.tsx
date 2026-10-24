import Link from 'next/link';
import { categorySlug, type PublicService } from '@/lib/publicServices';
import { US_STATES } from '@/lib/states';
import ServiceCard from '../ServiceCard';

/** A category's public services, optionally in one state, with links to the states that have any. */
export default function CategoryList({ category, services, state }: { category: string; services: PublicService[]; state?: string }) {
  const states = [...new Set(services.map((s) => s.state).filter(Boolean) as string[])].sort();
  const shown = state ? services.filter((s) => s.state === state || s.delivery !== 'on_site') : services;
  const stateName = state ? US_STATES.find(([c]) => c === state)?.[1] : null;
  return (
    <div className="container-page max-w-5xl py-12">
      <Link href={state ? `/hire/${categorySlug(category)}` : '/hire'} className="text-sm text-muted hover:text-navy">← {state ? category : 'Hire a veteran freelancer'}</Link>
      <h1 className="mt-4 font-serif text-4xl font-medium leading-tight sm:text-5xl">Veteran {category.toLowerCase()} pros{stateName ? ` in ${stateName}` : ''}</h1>
      <p className="mt-3 max-w-2xl text-muted">Verified veterans and military spouses offering {category.toLowerCase()}{stateName ? `, on site in ${stateName} or remote` : ''}. Pros never pay lead fees; you pay a small booking fee when you hire.</p>
      {states.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          {states.map((st) => <Link key={st} href={`/hire/${categorySlug(category)}/${st.toLowerCase()}`} aria-current={st === state ? 'page' : undefined} className={`rounded-full border px-3 py-1 ${st === state ? 'border-brass bg-brass/10 text-navy' : 'border-line hover:border-brass'}`}>{US_STATES.find(([c]) => c === st)?.[1] ?? st}</Link>)}
        </div>
      )}
      {shown.length === 0 ? (
        <div className="card mt-8 p-8 text-center">
          <p className="font-semibold text-ink">No public {category.toLowerCase()} listings{stateName ? ` in ${stateName}` : ''} yet.</p>
          <p className="mt-2 text-sm text-muted">Post your project and verified pros will send proposals.</p>
          <Link href="/freelance/projects/new" className="btn btn-primary mt-5">Post a project</Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">{shown.map((s) => <ServiceCard key={s.id} s={s} />)}</div>
      )}
    </div>
  );
}
