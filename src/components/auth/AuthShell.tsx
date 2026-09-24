import Crest from '../Crest';
import StarRule from '../StarRule';

export default function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-72px)] lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-navy-deep p-14 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-6 border border-brass/30" aria-hidden="true" />
        <Crest className="relative h-12 w-20" />
        <div className="relative text-ivory">
          <StarRule />
          <p className="mt-6 max-w-md font-serif text-4xl italic leading-snug">
            Your service built the foundation. Now let’s build what’s next.
          </p>
          <p className="mt-8 text-xs tracking-[0.3em] text-brass-light">SERVICE · LEADERSHIP · OPPORTUNITY</p>
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
