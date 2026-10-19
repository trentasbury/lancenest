import Link from 'next/link';

/** One line on what the Verified badge does and doesn't mean, shown wherever it can influence hiring. */
export default function VerifiedNote() {
  return (
    <>
      <span className="font-medium text-[#2f7a3e]">✓ Verified</span> means a LanceNest reviewer confirmed military service against a photo ID.
      It is not a background, employment, credential, or clearance check. <Link href="/trust" className="underline hover:text-navy">What we check</Link>.
    </>
  );
}
