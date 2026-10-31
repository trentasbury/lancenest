'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * "I'll cover the booking fee". Starts checked for on-site work (homeowners compare with lead sites where the customer
 * pays nothing) and unchecked for remote-only work, following the form's delivery choice until the member changes it.
 */
export default function CoverFeeBox() {
  const ref = useRef<HTMLInputElement>(null);
  const [checked, setChecked] = useState(true);
  const touched = useRef(false);
  useEffect(() => {
    const select = ref.current?.form?.elements.namedItem('delivery') as HTMLSelectElement | null;
    if (!select) return;
    const sync = () => { if (!touched.current) setChecked(select.value !== 'remote'); };
    sync();
    select.addEventListener('change', sync);
    return () => select.removeEventListener('change', sync);
  }, []);
  return (
    <label className="flex items-start gap-2 text-sm sm:col-span-2">
      <input ref={ref} type="checkbox" name="covers_booking_fee" checked={checked} onChange={(e) => { touched.current = true; setChecked(e.target.checked); }} className="mt-1 accent-navy" />
      <span>I’ll cover the booking fee. Clients see “No booking fee” on this service, and you pay LanceNest’s booking fee (5% of the job, $4.99 to $249) only when a client books you, before contact details open. No lead fees, ever: unlike lead sites, you never pay for a lead you don’t win. Recommended for on-site work.</span>
    </label>
  );
}
