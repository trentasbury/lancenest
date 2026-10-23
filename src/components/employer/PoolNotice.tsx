import FlashNotice from '@/components/profile/FlashNotice';

/** Confirmation after "Save to talent pool" (the action returns with ?pool=saved or ?pool=upgrade). */
export default function PoolNotice({ pool }: { pool: string }) {
  if (pool === 'saved') return <FlashNotice ok text="Saved to your talent pool." link={['Open talent pool', '/employer/talent']} />;
  if (pool === 'upgrade') return <FlashNotice ok={false} text="Talent pools are included with the Professional, Federal and Enterprise plans." link={['Compare plans', '/employers']} />;
  return null;
}
