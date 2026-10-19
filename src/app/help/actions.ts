'use server';

import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, SITE } from '@/lib/email';
import { KINDS, KIND_LABEL, type Kind } from './kinds';

const t = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? '').trim().slice(0, max);
const SSN = /\b\d{3}-?\d{2}-?\d{4}\b/;

/** Saves a help request, bug report, or idea, then alerts the admins. Works signed in or out (for sign-in trouble). */
export async function submitSupportRequest(formData: FormData) {
  if (t(formData, 'website', 200)) redirect('/help?sent=1');   // honeypot: bots fill hidden fields
  const session = await getSessionProfile();
  const raw = t(formData, 'kind', 20);
  const kind: Kind = KINDS.some(([v]) => v === raw) ? (raw as Kind) : 'support';
  const subject = t(formData, 'subject', 140);
  const details = t(formData, 'details', 4000);
  const pageRaw = t(formData, 'page_url', 500);
  const page_url = pageRaw && (pageRaw.startsWith('/') || /^https:\/\/(www\.)?lancenest\.com\//i.test(pageRaw)) ? pageRaw : null;
  const name = session ? session.profile?.full_name ?? null : t(formData, 'name', 120) || null;
  const email = session ? session.user.email ?? null : t(formData, 'email', 200).toLowerCase();
  const back = `/help?kind=${kind}`;

  if (subject.length < 3 || details.length < 10) redirect(`${back}&error=missing`);
  if (!session && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email ?? '')) redirect(`${back}&error=email`);
  if (SSN.test(`${subject} ${details}`)) redirect(`${back}&error=pii`);

  const admin = createAdminClient();
  // At most 5 messages an hour from one person, to keep the queue readable.
  const since = new Date(Date.now() - 3600_000).toISOString();
  const recent = admin.from('support_requests').select('id', { count: 'exact', head: true }).gte('created_at', since);
  const { count } = await (session ? recent.eq('profile_id', session.user.id) : recent.eq('email', email!));
  if ((count ?? 0) >= 5) redirect(`${back}&error=busy`);

  const { error } = await admin.from('support_requests').insert({
    profile_id: session?.user.id ?? null, name, email, kind, subject, details, page_url,
  });
  if (error) {
    console.error('support request failed:', error.message);
    redirect(`${back}&error=save`);
  }

  const label = KIND_LABEL[kind];
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  if (admins?.length) await admin.from('notifications').insert(admins.map((a) => ({ profile_id: a.id, type: 'support', title: `${label}: ${subject}`, link: '/admin/feedback' })));
  await sendEmail('support@lancenest.com', {
    subject: `${label}: ${subject}`, preheader: `${name ?? email ?? 'A member'} · ${label}`, tone: kind === 'bug' ? 'alert' : 'notice', badge: label,
    heading: subject, paragraphs: [details, `From: ${name ?? '—'} (${email ?? 'no email'})${session ? ` · ${session.profile?.role ?? ''}` : ' · signed out'}`, ...(page_url ? [`Page: ${page_url}`] : [])],
    cta: { label: 'Open the feedback queue', url: `${SITE}/admin/feedback` },
  });
  redirect(session ? '/help?sent=1#requests' : '/help?sent=1');
}
