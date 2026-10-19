import Link from 'next/link';
import { signOut } from '@/app/auth/actions';
import Wordmark from './Wordmark';
import MobileMenu from './MobileMenu';
import NavAccount from './nav/NavAccount';
import NavLinks from './nav/NavLinks';
import SessionExtras from './nav/SessionExtras';

/**
 * The top menu is the same HTML for every visitor, so every page around it can be pre-built and
 * served from the location nearest each visitor. Both menus are in the page; a tiny script in
 * <head> marks the page signed-in or signed-out before it's drawn, and CSS shows the right one
 * (.nav-in / .nav-out, .nav-employer / .nav-not-employer). Names, photos, and unread counts load
 * in the browser for signed-in members only (see nav/useMe).
 */
export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ivory/90 backdrop-blur-md supports-[backdrop-filter]:bg-ivory/75">
      <SessionExtras />
      <div className="container-page flex h-[72px] items-center justify-between gap-6">
        <Wordmark />

        <NavLinks />

        <div className="hidden items-center gap-4 lg:flex">
          <Link href="/login" className="nav-out text-sm text-ink hover:text-brass-dark">Log in</Link>
          <Link href="/signup" className="nav-out btn btn-primary">Sign up</Link>
          <div className="nav-in flex items-center gap-4">
            <NavAccount signOutAction={signOut} />
          </div>
        </div>

        <MobileMenu signOutAction={signOut} />
      </div>
    </header>
  );
}
