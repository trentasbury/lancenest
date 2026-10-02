'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { OPEN_CATEGORIES } from '@/lib/freelance';
import { vetRateFor } from '@/lib/payments';
import { SITE, notifyMember } from '@/lib/email';
import { scamSignals } from '@/lib/scam';

const t = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? '').trim().slice(0, max);
const dollars = (v: string) => Math.round(Number(v.replace(/[$,\s]/g, '')) * 100);

export async function saveService(formData: FormData) {
  const { user, profile } = await requireVerifiedMember('/freelance/services/mine');
  if (!['veteran', 'admin'].includes(profile.role)) redirect('/freelance');
  if (formData.get('license_ack') !== 'on' || formData.get('duty_ack') !== 'on') redirect('/freelance/services/mine?error=ack');
  const title = t(formData, 'title', 100), description = t(formData, 'description', 3000), category = t(formData, 'category', 60);
  const price = dollars(t(formData, 'price', 12));
  if (title.length < 4 || description.length < 20 || !Number.isFinite(price) || price < 2000) redirect('/freelance/services/mine?error=required');
  if (scamSignals(`${title}\n${description}`, 'block').length) redirect('/freelance/services/mine?error=scam');
  const priceType = t(formData, 'price_type', 12), delivery = t(formData, 'delivery', 10);
  const { error } = await createClient().from('service_listings').insert({
    profile_id: user.id, title, description, category: OPEN_CATEGORIES.includes(category) ? category : 'Other', price_cents: price,
    price_type: ['fixed', 'hourly', 'starting_at'].includes(priceType) ? priceType : 'fixed', delivery: ['remote', 'on_site', 'both'].includes(delivery) ? delivery : 'remote',
    service_area: t(formData, 'service_area', 120) || null,
  });
  revalidatePath('/freelance/services/mine');
  redirect(`/freelance/services/mine?${error ? 'error=save' : 'saved=1'}`);
}

export async function setServiceStatus(id: string, status: 'active' | 'paused') {
  const { user } = await requireVerifiedMember('/freelance/services/mine');
  await createClient().from('service_listings').update({ status, updated_at: new Date().toISOString() }).eq('id', id).eq('profile_id', user.id);
  revalidatePath('/freelance/services/mine');
}

export async function deleteService(id: string) {
  const { user } = await requireVerifiedMember('/freelance/services/mine');
  await createClient().from('service_listings').delete().eq('id', id).eq('profile_id', user.id);
  revalidatePath('/freelance/services/mine');
}

/** A verified member or employer hires a service: creates a contract with Protected Payments (fund → work → approve → paid). */
export async function requestService(serviceId: string, formData: FormData) {
  const { user, profile } = await requireVerifiedMember(`/freelance/services/${serviceId}`);
  if (profile.role !== 'employer') redirect(`/freelance/services/${serviceId}`);
  const { data: s } = await createClient().from('service_listings').select('id, profile_id, title, price_cents, status').eq('id', serviceId).eq('status', 'active').maybeSingle();
  if (!s || s.profile_id === user.id) redirect('/freelance/services');
  const amount = dollars(t(formData, 'amount', 12));
  const note = t(formData, 'note', 2000);
  if (!Number.isFinite(amount) || amount < 2000) redirect(`/freelance/services/${serviceId}?error=amount`);
  if (note.length < 10) redirect(`/freelance/services/${serviceId}?error=note`);
  const admin = createAdminClient();
  const [{ data: fp }, { data: vet }] = await Promise.all([
    admin.from('freelancer_profiles').select('payouts_enabled').eq('profile_id', s.profile_id).maybeSingle(),
    admin.from('veteran_profiles').select('plan').eq('profile_id', s.profile_id).maybeSingle(),
  ]);
  if (!fp?.payouts_enabled) redirect(`/freelance/services/${serviceId}?error=payouts`);
  const { data: contract, error } = await admin.from('contracts').insert({
    client_id: user.id, freelancer_id: s.profile_id, service_id: s.id, title: s.title as string, request_note: note,
    veteran_fee_rate: vetRateFor((vet?.plan as string) ?? 'free'),
  }).select('id').single();
  if (error || !contract) redirect(`/freelance/services/${serviceId}?error=save`);
  await admin.from('milestones').insert({ contract_id: contract.id, title: s.title as string, amount_cents: amount });
  await notifyMember(s.profile_id as string, { type: 'contract', link: `/freelance/contracts/${contract.id}`, title: `New request for “${s.title}”. Review the details — work starts once the client funds it.`,
    email: { subject: `New service request: ${s.title}`, preheader: 'A verified member wants to hire you.', tone: 'success', badge: 'Hired',
      heading: 'Someone wants to hire you.', paragraphs: [`A verified LanceNest member requested “${s.title}”.`, `Their note: ${note}`, 'Wait for “Funded” before starting — that means the payment is protected. You can decline if it isn’t a fit.'],
      cta: { label: 'Review the request', url: `${SITE}/freelance/contracts/${contract.id}` } } });
  redirect(`/freelance/contracts/${contract.id}?hired=1`);
}
