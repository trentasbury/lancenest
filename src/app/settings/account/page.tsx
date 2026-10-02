import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole, roleHome } from '@/lib/auth';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { deleteMyAccount, removeAvatar, saveAccountProfile, signOutEverywhere } from './actions';
import AvatarUpload from '@/components/AvatarUpload';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Account settings', robots: { index: false } };

const ERRORS: Record<string, string> = {
  confirm: 'Type DELETE and check the box to confirm.',
  failed: 'Your account couldn’t be deleted. Please try again or email support@lancenest.com.',
  admin: 'Admin accounts can’t be deleted from here. Remove the admin role first.',
};

export default async function AccountPage({ searchParams }: { searchParams: { error?: string; photo?: string; profile?: string } }) {
  const { user, profile } = await requireRole(['veteran', 'employer', 'admin'], '/settings/account');
  const { data: strikes } = await createClient().from('member_strikes').select('level, reason, created_at').eq('profile_id', user.id).order('created_at', { ascending: false });
  const { data: devices } = await createClient().from('login_devices').select('label, first_seen, last_seen').eq('profile_id', user.id).order('last_seen', { ascending: false }).limit(10);
  return (
    <div className="container-page max-w-2xl space-y-6 py-10">
      <Link href={roleHome(profile.role)} className="text-sm text-muted hover:text-navy">← Dashboard</Link>
      <h1 className="font-serif text-4xl font-medium">Account settings</h1>
      {searchParams.error && <FormMessage error={ERRORS[searchParams.error] ?? ERRORS.failed} />}

      <section className="card p-7">
        <h2 className="font-serif text-2xl font-semibold">Your profile</h2>
        {searchParams.photo && <p className={`mt-2 text-sm ${['saved', 'removed'].includes(searchParams.photo) ? 'text-olive' : 'text-signal'}`}>{{ saved: 'Photo updated.', removed: 'Photo removed.', type: 'Upload a JPG, PNG, or WebP image.', size: 'Photos must be under 2 MB.', failed: 'That upload didn’t go through — please try again.' }[searchParams.photo]}</p>}
        {searchParams.profile && <p className={`mt-2 text-sm ${searchParams.profile === 'saved' ? 'text-olive' : 'text-signal'}`}>{searchParams.profile === 'saved' ? 'Profile saved.' : 'Please enter your full name.'}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="h-20 w-20 rounded-full border-2 border-brass object-cover" />
          ) : <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-brass bg-navy font-serif text-2xl text-brass">{(profile.full_name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>}
          <AvatarUpload />
          {profile.avatar_url && <form action={removeAvatar}><button className="text-xs text-muted hover:text-signal">Remove photo</button></form>}
        </div>
        <p className="mt-2 text-xs text-muted">A clear, professional headshot. Any photo from your phone or computer works. OPSEC: avoid photos showing unit insignia, locations, or equipment.</p>
        <form action={saveAccountProfile} className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="field-label" htmlFor="full_name">Full name</label><input id="full_name" name="full_name" required defaultValue={profile.full_name ?? ''} className="field" /></div>
          <div><label className="field-label" htmlFor="headline">Headline</label><input id="headline" name="headline" maxLength={140} defaultValue={profile.headline ?? ''} placeholder="e.g. Founder, LanceNest · USMC Veteran" className="field" /></div>
          <div><label className="field-label" htmlFor="location">Location</label><input id="location" name="location" maxLength={120} defaultValue={profile.location ?? ''} placeholder="City, State" className="field" /></div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <SubmitButton className="btn btn-primary" pendingText="Saving…">Save profile</SubmitButton>
            {(profile.role === 'veteran' || profile.role === 'admin') && <Link href="/dashboard/profile" className="text-sm text-navy underline">Edit your About, military career, résumés, and more →</Link>}
          </div>
        </form>
      </section>

      <section className="card p-7">
        <h2 className="font-serif text-2xl font-semibold">Your account</h2>
        <p className="mt-3 text-sm"><span className="text-muted">Email:</span> {user.email}</p>
        <p className="mt-1 text-sm"><span className="text-muted">Account type:</span> <span className="capitalize">{profile.role}</span></p>
        <div className="mt-4 flex flex-wrap gap-2">
          {profile.role === 'veteran' && <Link href="/dashboard/profile" className="btn btn-outline">Edit profile</Link>}
          <Link href="/forgot-password" className="btn btn-outline">Change password</Link>
          <Link href="/network/people?tab=blocked" className="btn btn-ghost border border-line">Blocked & muted</Link>
        </div>
      </section>

      <section className="card p-7">
        <h2 className="font-serif text-2xl font-semibold">Security</h2>
        <p className="mt-2 text-sm text-muted">We alert you when your account signs in from a new device. Sessions end after 30 minutes of inactivity.</p>
        {(devices ?? []).length > 0 && (
          <ul className="mt-4 divide-y divide-line rounded-[4px] border border-line text-sm">
            {(devices ?? []).map((d, i) => (
              <li key={i} className="flex justify-between gap-3 px-4 py-2.5">
                <span>{d.label as string}</span>
                <span className="text-muted">last used {new Date(d.last_seen as string).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
              </li>
            ))}
          </ul>
        )}
        <form action={signOutEverywhere} className="mt-4">
          <SubmitButton className="btn btn-outline" pendingText="Signing out…">Sign out of all devices</SubmitButton>
        </form>
      </section>

      <section className="card p-7">
        <h2 className="font-serif text-2xl font-semibold">Conduct record</h2>
        {(strikes ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-olive">✓ In good standing — no warnings or actions on your account.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-[4px] border border-line text-sm">
            {(strikes ?? []).map((st, i) => (
              <li key={i} className="px-4 py-3"><span className="font-semibold capitalize">{st.level as string}</span> · {new Date(st.created_at as string).toLocaleDateString('en-US', { dateStyle: 'medium' })}<p className="text-muted">{st.reason as string}</p></li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">See the <Link href="/conduct" className="underline">Code of Conduct</Link>. Appeals: support@lancenest.com within 30 days.</p>
      </section>

      <section className="card border-signal/40 p-7">
        <h2 className="font-serif text-2xl font-semibold text-signal">Delete account</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink/85">
          This permanently deletes your profile, posts, comments, messages you sent, applications, uploaded files, and any
          verification documents{profile.role === 'employer' ? ', plus your company page and job posts. Any paid plan is canceled immediately' : ''}. It can’t be undone.
        </p>
        <form action={deleteMyAccount} className="mt-5 space-y-4">
          <div>
            <label htmlFor="confirm" className="field-label">Type DELETE to confirm</label>
            <input id="confirm" name="confirm" autoComplete="off" className="field" />
          </div>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" name="understand" className="mt-0.5 h-4 w-4 accent-signal" />
            I understand this is permanent.
          </label>
          <SubmitButton className="btn border border-signal bg-signal text-ivory hover:bg-signal/90" pendingText="Deleting…">Permanently delete my account</SubmitButton>
        </form>
      </section>
    </div>
  );
}
