import { initials } from '@/lib/format';

export default function CompanyMark({ name, logoUrl, size = 'md' }: { name: string; logoUrl?: string | null; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-16 w-16 text-xl' : 'h-11 w-11 text-sm';
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={`${name} logo`} className={`${box} rounded-[3px] border border-line bg-white object-contain`} />;
  }
  return (
    <div className={`${box} flex shrink-0 items-center justify-center rounded-[3px] bg-navy font-serif font-semibold text-brass`} aria-hidden="true">
      {initials(name)}
    </div>
  );
}
