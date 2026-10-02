import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe';
import { notifyMember } from '@/lib/email';

// A free month of the referrer's CURRENT plan. Free plans earn nothing.
const MEMBER_MONTH: Record<string, number> = { pro: 2400, pro_plus: 2400, federal_pro: 2400 };
const COMPANY_MONTH: Record<string, number> = { professional: 24900, federal: 59900, enterprise: 125000 };
const LABEL: Record<string, string> = { pro: 'Pro', pro_plus: 'Pro Plus', federal_pro: 'Federal', professional: 'Professional', federal: 'Federal', enterprise: 'Enterprise' };
export const REFERRAL_CAP_PER_YEAR = 3;
const MEMBER = ['veteran', 'admin'];

/** A referred member counts once verified AND their profile is filled in (no sign-up-and-abandon accounts). */
async function memberIsActive(profileId: string) {
  const admin = createAdminClient();
  const [{ data: p }, { data: v }, { count: svc }, { count: skills }] = await Promise.all([
    admin.from('profiles').select('headline').eq('id', profileId).maybeSingle(),
    admin.from('veteran_profiles').select('verification_status').eq('profile_id', profileId).maybeSingle(),
    admin.from('military_service').select('id', { count: 'exact', head: true }).eq('profile_id', profileId),
    admin.from('profile_skills').select('skill_id', { count: 'exact', head: true }).eq('profile_id', profileId),
  ]);
  return v?.verification_status === 'verified' && !!p?.headline && (svc ?? 0) > 0 && (skills ?? 0) >= 3;
}

/**
 * Members earn for referring members (verified + completed profile). Companies earn for referring companies
 * (after that company's first payment). Cross-referrals earn nothing. Capped at 3 free months per 12 months.
 * `event` says what just happened to the referred account.
 */
export async function rewardReferrer(referredProfileId: string, event: 'member_active' | 'company_paid') {
  const admin = createAdminClient();
  const { data: referred } = await admin.from('profiles').select('referred_by, full_name, role').eq('id', referredProfileId).maybeSingle();
  if (!referred?.referred_by) return;
  const { data: ref } = await admin.from('profiles').select('id, role').eq('id', referred.referred_by).maybeSingle();
  if (!ref) return;
  const refIsMember = MEMBER.includes(ref.role as string), referredIsMember = MEMBER.includes(referred.role as string);
  if (event === 'member_active' && !(refIsMember && referredIsMember)) return;
  if (event === 'company_paid' && referred.role !== 'employer') return;
  const vetBringsCompany = event === 'company_paid' && refIsMember;   // a service member brought in a paying company
  if (event === 'company_paid' && !vetBringsCompany && ref.role !== 'employer') return;
  if (event === 'member_active' && !(await memberIsActive(referredProfileId))) return;
  const { count: already } = await admin.from('referral_rewards').select('referred_id', { count: 'exact', head: true }).eq('referred_id', referredProfileId);
  if (already) return;

  let cents = 0, plan = 'free', customer: string | null = null;
  if (refIsMember) {
    const [{ data: v }, { data: bc }] = await Promise.all([
      admin.from('veteran_profiles').select('plan').eq('profile_id', ref.id).maybeSingle(),
      admin.from('billing_customers').select('stripe_customer_id').eq('profile_id', ref.id).maybeSingle(),
    ]);
    plan = (v?.plan as string) ?? 'free'; cents = MEMBER_MONTH[plan] ?? 0; customer = (bc?.stripe_customer_id as string) ?? null;
  } else {
    const { data: c } = await admin.from('companies').select('plan, stripe_customer_id').eq('owner_id', ref.id).maybeSingle();
    plan = (c?.plan as string) ?? 'free'; cents = COMPANY_MONTH[plan] ?? 0; customer = (c?.stripe_customer_id as string) ?? null;
  }
  const { count: recent } = await admin.from('referral_rewards').select('referred_id', { count: 'exact', head: true })
    .eq('referrer_id', ref.id).gt('cents', 0).gte('created_at', new Date(Date.now() - 365 * 86400000).toISOString());
  // A service member who brings a paying company earns 2 months, outside the yearly cap (every one is a new paying customer).
  if (vetBringsCompany) return rewardVeteranForCompany(ref.id as string, referredProfileId, who(referred.full_name), plan, cents, customer);
  const capped = (recent ?? 0) >= REFERRAL_CAP_PER_YEAR;
  const pay = cents > 0 && !!customer && !capped;
  // Record first (primary key on referred_id makes this pay out at most once).
  const { error } = await admin.from('referral_rewards').insert({ referred_id: referredProfileId, referrer_id: ref.id, cents: pay ? cents : 0, note: pay ? LABEL[plan] : capped ? 'cap reached' : 'free plan' });
  if (error) return;
  const whoName = who(referred.full_name);
  if (!pay) {
    await notifyMember(ref.id as string, { type: 'referral', link: refIsMember ? '/dashboard' : '/employer/dashboard',
      title: capped ? `${whoName} joined on your referral — thank you. You’ve earned the maximum of ${REFERRAL_CAP_PER_YEAR} free months this year.` : `${whoName} joined on your referral — thank you. On a paid plan, each referral like this earns a free month of your plan.` });
    return;
  }
  await stripe().customers.createBalanceTransaction(customer!, { amount: -cents, currency: 'usd', description: `Referral credit: one month of ${LABEL[plan]}` }, { idempotencyKey: `referral-${referredProfileId}` });
  await notifyMember(ref.id as string, { type: 'referral', link: refIsMember ? '/dashboard' : '/employer/dashboard', title: `${whoName} joined on your referral — a free month of ${LABEL[plan]} ($${(cents / 100).toFixed(0)}) is credited to your next bill.` });
}

const who = (name: string | null | undefined) => name ?? 'Someone you invited';

/**
 * A service member brought in a company that is verified and has paid:
 * Federal members get 2 months of Federal free; everyone else gets 2 months of Pro Plus.
 */
async function rewardVeteranForCompany(vetId: string, companyOwnerId: string, name: string, plan: string, monthCents: number, customer: string | null) {
  const admin = createAdminClient();
  const { data: co } = await admin.from('companies').select('is_verified').eq('owner_id', companyOwnerId).maybeSingle();
  if (!co?.is_verified) return;   // verified AND paid
  const MONTHS = 2;
  const federal = false;   // single Pro tier: everyone earns 2 months of Pro
  // Credit what they already pay for MONTHS months (covers Federal, Pro Plus, or Pro bills).
  const credit = monthCents > 0 && customer ? monthCents * MONTHS : 0;
  // Non-Federal members also get Pro Plus access for MONTHS months (Free and Pro are upgraded; Pro Plus is simply credited).
  const grant = plan === 'free';
  const { error } = await admin.from('referral_rewards').insert({ referred_id: companyOwnerId, referrer_id: vetId, cents: credit,
    note: federal ? '2 months Federal (company referral)' : '2 months Pro Plus (company referral)' });
  if (error) return;
  if (credit) await stripe().customers.createBalanceTransaction(customer!, { amount: -credit, currency: 'usd', description: `Referral: ${MONTHS} months ${federal ? 'of Federal' : 'toward Pro Plus'} for bringing a company` }, { idempotencyKey: `referral-${companyOwnerId}` });
  if (grant) {
    const { data: v } = await admin.from('veteran_profiles').select('pro_granted_until, granted_plan').eq('profile_id', vetId).maybeSingle();
    const base = v?.pro_granted_until && Date.parse(v.pro_granted_until as string) > Date.now() ? Date.parse(v.pro_granted_until as string) : Date.now();
    await admin.from('veteran_profiles').update({ granted_plan: 'pro', pro_granted_until: new Date(base + MONTHS * 30 * 86400000).toISOString() }).eq('profile_id', vetId);
    const { recomputeVeteran } = await import('@/lib/billing');
    await recomputeVeteran(vetId);
  }
  await notifyMember(vetId, { type: 'referral', link: '/dashboard', title: `${name} joined LanceNest on your referral — you’ve earned ${MONTHS} free months of Pro. Thank you.` });
}
