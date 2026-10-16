'use client';

import { useSearchParams } from 'next/navigation';

/**
 * A banner shown when the address has a given ?param (e.g. ?deleted=1 after an account is deleted).
 * Read in the browser so the page itself can stay pre-built. Wrap in <Suspense>.
 */
export default function QueryNotice({ param, message, className }: { param: string; message: string; className?: string }) {
  const params = useSearchParams();
  if (!params.get(param)) return null;
  return <div role="status" className={className}>{message}</div>;
}
