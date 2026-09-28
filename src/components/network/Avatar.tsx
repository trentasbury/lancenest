import { initials } from '@/lib/format';

export default function Avatar({ name, size = 'md', src }: { name: string | null | undefined; size?: 'sm' | 'md' | 'lg'; src?: string | null }) {
  const box = size === 'lg' ? 'h-14 w-14 text-lg' : size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-11 w-11 text-sm';
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt="" className={`${box.split(' text-')[0]} shrink-0 rounded-full border border-brass object-cover`} />;
  return (
    <span className={`${box} flex shrink-0 items-center justify-center rounded-full border border-brass bg-navy font-serif text-brass`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
