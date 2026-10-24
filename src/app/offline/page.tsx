import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'You’re offline', robots: { index: false } };

export default function OfflinePage() {
  return (
    <div className="container-page flex flex-col items-center py-28 text-center">
      <p className="eyebrow">No connection</p>
      <h1 className="mt-4 font-serif text-5xl font-medium">You’re offline.</h1>
      <p className="mt-6 max-w-md text-muted">LanceNest needs a connection to load jobs and messages. Check your signal or Wi-Fi, then try again.</p>
      <a href="/dashboard" className="btn btn-primary mt-8">Try again</a>
    </div>
  );
}
