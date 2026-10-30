import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import SubmitButton from '@/components/SubmitButton';
import { saveCommitment, saveCommitments, saveCompanyDetails, uploadCompanyImage } from './actions';
import FlashNotice from '@/components/profile/FlashNotice';
import { createAdminClient } from '@/lib/supabase/admin';
import { siteHost } from '@/lib/applyLinks';

export const metadata: Metadata = { title: 'Company page' };
const ERR: Record<string, string> = { explicit: 'That includes language LanceNest doesn’t allow, such as sexual content or slurs. Please edit it.', type: 'Upload a JPG, PNG, or WebP image.', size: 'Images must be under 2 MB.', upload: 'That upload didn’t go through — please try again.', plan: 'Cover photos are part of Professional and Federal plans.',
  website: 'Enter your full website address, like https://yourcompany.com.', details: 'Your company details didn’t save. Please try again.' };

export default async function CompanyBrandingPage(props: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const searchParams = await props.searchParams;
  const { user } = await requireRole(['employer'], '/employer/company');
  const [{ data: c }, { data: v }] = await Promise.all([
    (await createClient()).from('companies').select('name, slug, plan, logo_url, cover_url, veteran_commitment, website, industry, headquarters, about, mission, benefits, is_verified').eq('owner_id', user.id).maybeSingle(),
    // The verified website is private (server-only): it decides which links this company may use.
    createAdminClient().from('companies').select('verification_details, msep_status, guard_reserve_pledge').eq('owner_id', user.id).maybeSingle(),
  ]);
  if (!c) redirect('/employer/dashboard');
  const verifiedHost = siteHost((v?.verification_details as { website?: string } | null)?.website);
  const paid = ['professional', 'federal', 'enterprise'].includes(c.plan as string);
  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <Link href="/employer/dashboard" className="text-sm text-muted hover:text-navy">← Employer dashboard</Link>
      <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="font-serif text-4xl font-medium">Your company page</h1><Link href={`/companies/${c.slug}`} className="btn btn-outline">View page</Link></div>
      {searchParams.error && <FlashNotice ok={false} text={searchParams.error === 'domain' ? `Your public website must be on ${verifiedHost}, the domain you verified (a subdomain like careers.${verifiedHost} works too).` : ERR[searchParams.error] ?? ERR.upload} />}
      {searchParams.saved && <FlashNotice ok text={searchParams.saved === 'details' ? 'Company details saved.' : 'Saved.'} link={['View your page', `/companies/${c.slug}`]} />}
      <form action={saveCompanyDetails} className="card grid gap-4 p-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <p className="eyebrow">Company details</p>
          <p className="mt-1 text-sm text-muted">Shown at the top of your company page and on every job you post.</p>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="co-name" className="field-label">Company name</label>
          {c.is_verified
            ? <><p id="co-name" className="field bg-paper text-ink">{c.name as string}</p><p className="mt-1 text-xs text-muted">Locked once verified. To change it, <Link href="/help?kind=support&subject=Company%20name%20change" className="underline">ask us through the Help page</Link>.</p></>
            : <input id="co-name" name="name" required maxLength={120} defaultValue={c.name as string} className="field" />}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="co-website" className="field-label">Website</label>
          <input id="co-website" name="website" type="url" inputMode="url" maxLength={300} defaultValue={(c.website as string) ?? ''} placeholder={verifiedHost ? `https://${verifiedHost}` : 'https://yourcompany.com'} className="field" />
          <p className="mt-1 text-xs text-muted">{verifiedHost ? <>Must be on <strong className="text-ink">{verifiedHost}</strong>, the domain you verified. </> : null}Shown as “Visit website” on your company page. To send applicants to your own careers site, choose “Your website” when you post a job.</p>
        </div>
        <div><label htmlFor="co-industry" className="field-label">Industry</label><input id="co-industry" name="industry" maxLength={80} defaultValue={(c.industry as string) ?? ''} placeholder="e.g. Defense & Aerospace" className="field" /></div>
        <div><label htmlFor="co-hq" className="field-label">Headquarters</label><input id="co-hq" name="headquarters" maxLength={120} defaultValue={(c.headquarters as string) ?? ''} placeholder="City, ST" className="field" /></div>
        <div className="sm:col-span-2"><label htmlFor="co-about" className="field-label">About</label><textarea id="co-about" name="about" rows={5} maxLength={4000} defaultValue={(c.about as string) ?? ''} placeholder="What your company does, who you serve, and what it's like to work there." className="field" /></div>
        <div><label htmlFor="co-mission" className="field-label">Mission (optional)</label><textarea id="co-mission" name="mission" rows={3} maxLength={2000} defaultValue={(c.mission as string) ?? ''} className="field" /></div>
        <div><label htmlFor="co-benefits" className="field-label">Benefits (optional)</label><textarea id="co-benefits" name="benefits" rows={3} maxLength={2000} defaultValue={(c.benefits as string) ?? ''} placeholder="Health, 401(k) match, tuition, military leave…" className="field" /></div>
        <div className="sm:col-span-2"><SubmitButton className="btn btn-primary" pendingText="Saving…">Save details</SubmitButton></div>
      </form>
      <section className="card p-6">
        <p className="eyebrow">Logo</p>
        {c.logo_url && <img src={c.logo_url as string} alt="" className="mt-3 h-16 w-16 rounded-xl border border-line object-contain" />}
        <form action={uploadCompanyImage.bind(null, 'logo')} className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="file" name="file" accept="image/jpeg,image/png,image/webp" required className="field text-sm" /><SubmitButton className="btn btn-outline shrink-0" pendingText="Uploading…">Upload logo</SubmitButton></form>
      </section>
      <section className="card p-6">
        <p className="eyebrow">Cover photo {paid ? '' : '· Professional'}</p>
        {c.cover_url && <img src={c.cover_url as string} alt="" className="mt-3 h-32 w-full rounded-xl object-cover" />}
        {paid ? (
          <form action={uploadCompanyImage.bind(null, 'cover')} className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="file" name="file" accept="image/jpeg,image/png,image/webp" required className="field text-sm" /><SubmitButton className="btn btn-outline shrink-0" pendingText="Uploading…">Upload cover</SubmitButton></form>
        ) : <p className="mt-2 text-sm text-muted">Add a wide cover photo of your team or workplace with <Link href="/employers" className="text-navy underline">Professional</Link>.</p>}
        <p className="mt-2 text-xs text-muted">Wide images work best (about 1600 × 500), under 2 MB.</p>
      </section>
      <form action={saveCommitment} className="card space-y-3 p-6">
        <p className="eyebrow">Why veterans work here</p>
        <textarea name="veteran_commitment" rows={5} maxLength={2000} defaultValue={(c.veteran_commitment as string) ?? ''} placeholder="Veteran hiring programs, SkillBridge, Guard & Reserve support, veterans on the team…" className="field" />
        {!paid && <p className="text-xs text-muted">Shown on your page for every plan; Professional pages feature it prominently under your cover photo.</p>}
        <SubmitButton className="btn btn-primary" pendingText="Saving…">Save</SubmitButton>
      </form>
      <CommitmentsForm msep={(v?.msep_status as string) ?? 'none'} pledge={!!v?.guard_reserve_pledge} />
    </div>
  );
}

function CommitmentsForm({ msep, pledge }: { msep: string; pledge: boolean }) {
  return (
    <form action={saveCommitments} className="card space-y-4 p-6">
      <div><p className="eyebrow">Commitments</p><p className="mt-1 text-sm text-muted">Shown as badges on your jobs and company page, and members can filter jobs by them.</p></div>
      <label className="flex items-start gap-3 text-sm text-ink">
        <input type="checkbox" name="guard_reserve" defaultChecked={pledge} className="mt-0.5 h-4 w-4 accent-navy" />
        <span><strong>Guard &amp; Reserve pledge.</strong> We support employees who serve in the National Guard and Reserve, including drill weekends, annual training and deployments, as USERRA requires and beyond.</span>
      </label>
      <label className="flex items-start gap-3 text-sm text-ink">
        <input type="checkbox" name="msep" defaultChecked={msep === 'pending' || msep === 'verified'} className="mt-0.5 h-4 w-4 accent-navy" />
        <span><strong>Military Spouse Employment Partnership (MSEP) partner.</strong> We’re a DoD MSEP partner employer.{' '}
          {msep === 'verified' ? <span className="text-olive">✓ Confirmed</span> : msep === 'pending' ? <span className="text-muted">We’re checking the public partner list.</span> : msep === 'rejected' ? <span className="text-signal">We couldn’t find you on the public partner list.</span> : null}</span>
      </label>
      <SubmitButton className="btn btn-primary" pendingText="Saving…">Save commitments</SubmitButton>
    </form>
  );
}
