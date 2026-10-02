'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMyCompany } from '@/lib/employer';
import { sendEmail, SITE } from '@/lib/email';

const PLACEMENT_RATE = 0.10;

async function myRequest(requestId: string) {
  const { user } = await requireRole(['employer'], '/employer/shortlists');
  const company = await getMyCompany(user.id);
  const { data: r } = await createClient().from('shortlist_requests').select('*').eq('id', requestId).maybeSingle();
  if (!company || !r || r.company_id !== company.id) redirect('/employer/shortlists');
  return { r, company };
}
async function tellAdmins(title: string) {
  const admin = createAdminClient();
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  if (admins?.length) await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'shortlist', title, link: '/admin/shortlists' })));
}

/** Employer reports a hire from the shortlist: 10% of first-year base salary, minus the shortlist fee already paid. */
export async function reportHire(requestId: string, formData: FormData) {
  const { r, company } = await myRequest(requestId);
  const profileId = String(formData.get('profile_id') ?? '');
  const salary = Math.round(Number(String(formData.get('salary') ?? '').replace(/[$,\s]/g, '')) * 100);
  if (!profileId || !Number.isFinite(salary) || salary < 1000000) redirect('/employer/shortlists?error=hire');
  const fee = r.engagement === 'contract' ? 0 : Math.max(0, Math.round(salary * PLACEMENT_RATE) - (r.amount_cents as number));
  await createAdminClient().from('shortlist_requests').update({ status: 'hired', hired_profile_id: profileId, placement_salary_cents: salary, placement_fee_cents: fee }).eq('id', requestId);
  await tellAdmins(`${company.name} hired from the “${r.role_title}” shortlist — placement fee $${(fee / 100).toLocaleString()} to invoice.`);
  await sendEmail('support@lancenest.com', { subject: `Placement: ${company.name} — ${r.role_title}`, preheader: `Invoice $${(fee / 100).toLocaleString()}`, tone: 'success', badge: 'Placement',
    heading: `${company.name} made a hire`, paragraphs: [`Role: ${r.role_title}`, `First-year base salary: $${(salary / 100).toLocaleString()}`, `Placement fee (10% minus the shortlist fee): $${(fee / 100).toLocaleString()}`, 'Send the invoice from Stripe → Invoices. 90-day replacement guarantee applies.'],
    cta: { label: 'Open shortlists', url: `${SITE}/admin/shortlists` } });
  revalidatePath('/employer/shortlists');
  redirect('/employer/shortlists?hired=1');
}

/** One free re-run if none of the candidates fit. */
export async function requestRerun(requestId: string) {
  const { r, company } = await myRequest(requestId);
  if (r.status !== 'delivered' || r.rerun_used) redirect('/employer/shortlists');
  await createAdminClient().from('shortlist_requests').update({ status: 'sourcing', rerun_used: true, due_at: new Date(Date.now() + 3 * 86400000).toISOString() }).eq('id', requestId);
  await tellAdmins(`${company.name} asked for a free re-run of the “${r.role_title}” shortlist.`);
  revalidatePath('/employer/shortlists');
  redirect('/employer/shortlists?rerun=1');
}
