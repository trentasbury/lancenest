import Link from 'next/link';

export default function RemovedPage() {
  return (
    <div className="container-page flex max-w-lg flex-col py-20 text-center">
      <p className="eyebrow text-signal">Account removed</p>
      <h1 className="mt-3 font-serif text-4xl font-medium">This account has been removed from LanceNest.</h1>
      <p className="mt-4 text-muted">It was removed for violating our <Link href="/conduct" className="underline">Code of Conduct</Link>. To appeal, email support@lancenest.com within 30 days.</p>
    </div>
  );
}
