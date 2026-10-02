'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, SITE } from '@/lib/email';

const t = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? '').trim().slice(0, max);

export async function requestCall(formData: FormData) {
  if (t(formData, 'website', 200)) redirect('/contact-sales?sent=1');   // honeypot: bots fill hidden fields
  const lead = { name: t(formData, 'name', 120), email: t(formData, 'email', 200).toLowerCase(), company: t(formData, 'company', 160),
    size: t(formData, 'size', 40) || null, plan: t(formData, 'plan', 20) || null, needs: t(formData, 'needs', 2000) || null, times: t(formData, 'times', 300) || null };
  if (lead.name.length < 2 || lead.company.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) redirect(`/contact-sales?error=1&plan=${lead.plan ?? ''}`);
  const admin = createAdminClient();
  await admin.from('sales_leads').insert(lead);
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  if (admins?.length) await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'lead', title: `Call request: ${lead.company} (${lead.plan ?? 'plan not chosen'}) — ${lead.name}`, link: '/admin/leads' })));
  await sendEmail('support@lancenest.com', { subject: `Call request: ${lead.company}`, preheader: `${lead.name} · ${lead.plan ?? ''}`, tone: 'notice', badge: 'Sales',
    heading: `${lead.name} at ${lead.company} wants a call`, paragraphs: [`Email: ${lead.email}`, `Plan: ${lead.plan ?? '—'} · Size: ${lead.size ?? '—'}`, `Hiring needs: ${lead.needs ?? '—'}`, `Good times: ${lead.times ?? '—'}`],
    cta: { label: 'Open call requests', url: `${SITE}/admin/leads` } });
  redirect('/contact-sales?sent=1');
}
