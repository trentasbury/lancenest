import Image from 'next/image';
import StarRule from '../StarRule';

export default function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-72px)] lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-navy-deep lg:block">
        <Image src="/assets/lighthouse.webp" alt="" fill priority quality={90} sizes="50vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-deep via-navy-deep/25 to-transparent" />
        <div className="pointer-events-none absolute inset-6 border border-brass/40" aria-hidden="true" />
        <div className="absolute inset-x-14 bottom-16 text-ivory">
          <StarRule />
          <p className="mt-5 max-w-md font-serif text-3xl italic leading-snug">
            Your service built the foundation. Now let’s build what’s next.
          </p>
          <p className="mt-6 text-xs tracking-[0.3em] text-brass-light">SERVICE · LEADERSHIP · OPPORTUNITY</p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center px-5 pb-14 sm:px-10 lg:pt-14">
        <div className="relative -mx-5 mb-10 h-48 w-[calc(100%+2.5rem)] overflow-hidden sm:-mx-10 sm:w-[calc(100%+5rem)] lg:hidden">
          <Image src="/assets/lighthouse.webp" alt="" fill priority quality={90} sizes="100vw" className="object-cover object-[center_35%]" />
          <div className="absolute inset-0 bg-gradient-to-t from-paper via-transparent to-transparent" />
        </div>
        <div className="w-full max-w-md">
          <h1 className="font-serif text-4xl font-medium">{title}</h1>
          {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
