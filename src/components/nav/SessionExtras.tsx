'use client';

import IdleTimer from '@/components/IdleTimer';
import { useMe } from './useMe';

/** Pieces that only run for signed-in members, on every screen size (the inactivity sign-out timer). */
export default function SessionExtras() {
  const me = useMe();
  return me?.signedIn ? <IdleTimer /> : null;
}
