'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CATEGORIES, OPEN_CATEGORIES } from '@/lib/freelance';
import { vetRateFor } from '@/lib/payments';
import { scamSignals } from '@/lib/scam';
import { getMyCompany } from '@/lib/employer';
import { FREELANCE_PAYMENTS_ENABLED } from '@/lib/flags';
import { bookingCheckoutUrl, bookingFeeCents, bookingRequired, markHired } from '@/lib/booking';

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
  // Licensed trades need the member's verified license for that trade (the database checks this too).
  const { licensedTrades } = await import('@/lib/credentials');
  const allowed = OPEN_CATEGORIES.includes(category) || (await licensedTrades(user.id)).includes(category);
  if (!allowed && CATEGORIES.includes(category)) redirect('/freelance/services/mine?error=licensed');
  const packages = readPackages(formData);
  if (packages === null) redirect('/freelance/services/mine?error=package');
  if (scamSignals(packages.map((p) => `${p.name}\n${p.includes}`).join('\n'), 'block').length) redirect('/freelance/services/mine?error=scam');
  const { error } = await (await createClient()).from('service_listings').insert({
    packages, public_listing: formData.get('public_listing') === 'on',
    profile_id: user.id, title, description, category: allowed ? category : 'Other', price_cents: price,
    price_type: ['fixed', 'hourly', 'starting_at'].includes(priceType) ? priceType : 'fixed', delivery: ['remote', 'on_site', 'both'].includes(delivery) ? delivery : 'remote',
    service_area: t(formData, 'service_area', 120) || null,
  });
  revalidatePath('/freelance/services/mine');
  revalidateTag('public-services', 'max');
  revalidatePath('/hire', 'layout');
  redirect(`/freelance/services/mine?${error ? `error=${error.code === 'P0017' ? 'contact' : error.code === 'P0018' ? 'licensed' : 'save'}` : 'saved=1'}`);
}

export type ServicePackage = { name: string; price_cents: number; days: number; includes: string };

/**
 * Up to 3 packages (like Fiverr's basic, standard and premium). A row left blank is skipped; a half-filled row
 * returns null so the form can say what's missing.
 */
function readPackages(formData: FormData): ServicePackage[] | null {
  const out: ServicePackage[] = [];
  for (const i of [1, 2, 3]) {
    const name = t(formData, `pkg${i}_name`, 40), priceRaw = t(formData, `pkg${i}_price`, 12), daysRaw = t(formData, `pkg${i}_days`, 3), includes = t(formData, `pkg${i}_includes`, 200);
    if (!name && !priceRaw && !daysRaw && !includes) continue;
    const price = dollars(priceRaw), days = Number.parseInt(daysRaw, 10);
    if (name.length < 3 || !Number.isFinite(price) || price < 2500 || !(days >= 1 && days <= 90) || includes.length < 5) return null;
    out.push({ name, price_cents: price, days, includes });
  }
  return out;
}

/** Opt in or out of the public service page (first name and last initial, city, no contact details). */
export async function setServicePublic(id: string, on: boolean) {
  const { user } = await requireVerifiedMember('/freelance/services/mine');
  await (await createClient()).from('service_listings').update({ public_listing: on, updated_at: new Date().toISOString() }).eq('id', id).eq('profile_id', user.id);
  revalidatePath('/freelance/services/mine');
  revalidateTag('public-services', 'max');
  revalidatePath('/hire', 'layout');
}

export async function setServiceStatus(id: string, status: 'active' | 'paused') {
  const { user } = await requireVerifiedMember('/freelance/services/mine');
  await (await createClient()).from('service_listings').update({ status, updated_at: new Date().toISOString() }).eq('id', id).eq('profile_id', user.id);
  revalidatePath('/freelance/services/mine');
  revalidateTag('public-services', 'max');
}

export async function deleteService(id: string) {
  const { user } = await requireVerifiedMember('/freelance/services/mine');
  await (await createClient()).from('service_listings').delete().eq('id', id).eq('profile_id', user.id);
  revalidatePath('/freelance/services/mine');
  revalidateTag('public-services', 'max');
}

/**
 * A verified employer hires a service. When a booking fee applies (see lib/booking.ts) the request is booked, and the
 * member told, once the employer pays it; the fee can't be skipped by paying in cash.
 */
export async function requestService(serviceId: string, formData: FormData) {
  const { user, profile } = await requireVerifiedMember(`/freelance/services/${serviceId}`);
  if (profile.role !== 'employer') redirect(`/freelance/services/${serviceId}`);
  const company = await getMyCompany(user.id);
  if (!company?.is_verified) redirect('/employer/dashboard?verify=required');
  const { data: s } = await (await createClient()).from('service_listings').select('id, profile_id, title, price_cents, status, delivery, packages').eq('id', serviceId).eq('status', 'active').maybeSingle();
  if (!s || s.profile_id === user.id) redirect('/freelance/services');
  const amount = dollars(t(formData, 'amount', 12));
  const note = t(formData, 'note', 2000);
  if (!Number.isFinite(amount) || amount < 2500) redirect(`/freelance/services/${serviceId}?error=amount`);
  if (note.length < 10) redirect(`/freelance/services/${serviceId}?error=note`);
  const admin = createAdminClient();
  const [{ data: fp }, { data: vet }] = await Promise.all([
    admin.from('freelancer_profiles').select('payouts_enabled').eq('profile_id', s.profile_id).maybeSingle(),
    admin.from('veteran_profiles').select('plan').eq('profile_id', s.profile_id).maybeSingle(),
  ]);
  // Payout setup only matters once LanceNest handles milestone payments.
  if (FREELANCE_PAYMENTS_ENABLED && !fp?.payouts_enabled) redirect(`/freelance/services/${serviceId}?error=payouts`);
  const onSite = s.delivery !== 'remote';
  // The fee follows the real size of the job: an amount under the listed price doesn't lower it.
  // The lowest listed price (base or package) is the floor.
  const floor = Math.min(s.price_cents as number, ...((s.packages as ServicePackage[] | null) ?? []).map((p) => p.price_cents));
  const fee = bookingRequired(onSite) ? bookingFeeCents(Math.max(amount, floor)) : 0;
  const { data: contract, error } = await admin.from('contracts').insert({
    client_id: user.id, freelancer_id: s.profile_id, service_id: s.id, title: s.title as string, request_note: note,
    veteran_fee_rate: vetRateFor((vet?.plan as string) ?? 'free'),
    on_site: onSite, booking_status: fee ? 'awaiting_payment' : 'not_required', booking_fee_cents: fee || null,
  }).select('id, title, client_id, freelancer_id, project_id, proposal_id, service_id').single();
  if (error || !contract) redirect(`/freelance/services/${serviceId}?error=${error?.code === 'P0017' ? 'contact' : 'save'}`);
  await admin.from('milestones').insert({ contract_id: contract.id, title: s.title as string, amount_cents: amount });
  if (fee) {
    let url: string | null = null;
    try { url = await bookingCheckoutUrl(contract.id as string, user.id, user.email); } catch (err) { console.error('booking checkout failed:', err); }
    redirect(url ?? `/freelance/contracts/${contract.id}?error=booking`);
  }
  await markHired(contract as Parameters<typeof markHired>[0]);
  redirect(`/freelance/contracts/${contract.id}?hired=1`);
}
