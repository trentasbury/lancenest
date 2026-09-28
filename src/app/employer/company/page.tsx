import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { saveCommitment, uploadCompanyImage } from './actions';

export const metadata: Metadata = { title: 'Company page' };
const ERR: Record<string, string> = { type: 'Upload a JPG, PNG, or WebP image.', size: 'Images must be under 2 MB.', upload: 'That upload didn’t go through — please try again.', plan: 'Cover photos are part of Professional and Federal plans.' };

export default async function CompanyBrandingPage({ searchParams }: { searchParams: { error?: string; saved?: string } }) {
  const { user } = await requireRole(['employer'], '/employer/company');
  const { data: c } = await createClient().from('companies').select('name, slug, plan, logo_url, cover_url, veteran_commitment').eq('owner_id', user.id).maybeSingle();
  if (!c) redirect('/employer/dashboard');
  const paid = ['professional', 'federal', 'enterprise'].includes(c.plan as string);
  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <Link href="/employer/dashboard" className="text-sm text-muted hover:text-navy">← Employer dashboard</Link>
      <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="font-serif text-4xl font-medium">Your company page</h1><Link href={`/companies/${c.slug}`} className="btn btn-outline">View page</Link></div>
      {searchParams.error && <FormMessage error={ERR[searchParams.error] ?? ERR.upload} />}
      {searchParams.saved && <FormMessage message="Saved." />}
      <section className="card p-6">
        <p className="eyebrow">Logo</p>
        {c.logo_url && <img src={c.logo_url as string} alt="" className="mt-3 h-16 w-16 rounded-[4px] border border-line object-contain" />}
        <form action={uploadCompanyImage.bind(null, 'logo')} className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="file" name="file" accept="image/jpeg,image/png,image/webp" required className="field text-sm" /><SubmitButton className="btn btn-outline shrink-0" pendingText="Uploading…">Upload logo</SubmitButton></form>
      </section>
      <section className="card p-6">
        <p className="eyebrow">Cover photo {paid ? '' : '· Professional'}</p>
        {c.cover_url && <img src={c.cover_url as string} alt="" className="mt-3 h-32 w-full rounded-[4px] object-cover" />}
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
    </div>
  );
}
