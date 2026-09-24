import Image from 'next/image';
import StarRule from '../StarRule';

export default function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-72px)] lg:grid-cols-2">
      <div className="relative hidden bg-navy-deep lg:block">
        <Image src="/assets/lighthouse.webp" alt="" fill sizes="50vw" className="object-cover opacity-80" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-deep via-navy-deep/30 to-transparent" />
        <div className="absolute inset-x-12 bottom-14 text-ivory">
          <StarRule />
          <p className="mt-5 font-serif text-3xl italic leading-snug">Your service built the foundation. Now let’s build what’s next.</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-5 py-14 sm:px-10">
        <div className="w-full max-w-md">
          <h1 className="font-serif text-4xl font-medium">{title}</h1>
          {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
