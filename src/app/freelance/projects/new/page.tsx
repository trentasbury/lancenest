import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireVerifiedMember } from '@/lib/auth';
import { getMyCompany } from '@/lib/employer';
import { CATEGORIES } from '@/lib/freelance';
import SubmitButton from '@/components/SubmitButton';
import FormMessage from '@/components/FormMessage';
import { createProject } from '../../actions';

export const metadata: Metadata = { title: 'Post a project' };
const ERR: Record<string, string> = { required: 'Add a title and a description of at least 20 characters.', budget: 'The maximum budget can’t be lower than the minimum.', scam: 'This description contains wording often used in scams (fees, gift cards, off-platform chat apps). Please revise it.', save: 'That didn’t post — please try again.', pii: 'That looks like a Social Security number. For your safety, LanceNest never allows SSNs to be shared — please remove it.' };

export default async function NewProjectPage({ searchParams }: { searchParams: { error?: string } }) {
  const { user, profile } = await requireVerifiedMember('/freelance/projects/new');
  if (profile.role !== 'employer') redirect('/freelance');
  const company = await getMyCompany(user.id);
  if (!company?.is_verified) redirect('/employer/dashboard?verify=required');
  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <Link href="/freelance" className="text-sm text-muted hover:text-navy">← Freelance</Link>
      <h1 className="font-serif text-4xl font-medium">Post a freelance project</h1>
      <p className="text-muted">Only verified service members can send proposals. You’ll fund each milestone before work starts, and the money is released when you approve it.</p>
      {searchParams.error && <FormMessage error={ERR[searchParams.error] ?? ERR.save} />}
      <form action={createProject} className="card grid gap-5 p-7 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="field-label" htmlFor="title">Project title</label><input id="title" name="title" required maxLength={140} placeholder="e.g. ServiceNow ITSM configuration for a federal program" className="field" /></div>
        <div className="sm:col-span-2"><label className="field-label" htmlFor="description">Scope of work</label><textarea id="description" name="description" required rows={7} maxLength={8000} placeholder="Deliverables, timeline, tools, and anything a freelancer needs to know." className="field" /></div>
        <div><label className="field-label" htmlFor="category">Category</label><select id="category" name="category" className="field">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label className="field-label" htmlFor="clearance_required">Clearance required</label>
          <select id="clearance_required" name="clearance_required" className="field"><option value="none">None</option><option value="public_trust">Public Trust</option><option value="confidential">Confidential</option><option value="secret">Secret</option><option value="top_secret">Top Secret</option><option value="ts_sci">TS/SCI</option></select></div>
        <div><label className="field-label" htmlFor="budget_type">Budget type</label><select id="budget_type" name="budget_type" className="field"><option value="fixed">Fixed price</option><option value="hourly">Hourly</option></select></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="field-label" htmlFor="budget_min">Min ($)</label><input id="budget_min" name="budget_min" inputMode="numeric" className="field" /></div><div><label className="field-label" htmlFor="budget_max">Max ($)</label><input id="budget_max" name="budget_max" inputMode="numeric" className="field" /></div></div>
        <p className="text-xs text-muted sm:col-span-2">Client fees: 5% by card or 3% by bank transfer, plus a $9.99 contract-start fee ($2.50 extra on projects under $200). Shown again before you pay.</p>
        <div className="sm:col-span-2"><SubmitButton className="btn btn-primary" pendingText="Posting…">Post project</SubmitButton></div>
      </form>
    </div>
  );
}
