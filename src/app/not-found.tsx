import Link from 'next/link';
import StarRule from '@/components/StarRule';

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-28 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 font-serif text-5xl font-medium">Off the map.</h1>
      <StarRule className="mt-6" />
      <p className="mt-6 max-w-md text-muted">The page you’re looking for doesn’t exist or has moved.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="btn btn-primary">Return home</Link>
        <Link href="/jobs" className="btn btn-outline">Find jobs</Link>
      </div>
    </div>
  );
}
