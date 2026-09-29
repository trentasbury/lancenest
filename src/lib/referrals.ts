import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe';
import { notifyMember } from '@/lib/email';

// One month of the referrer's CURRENT plan. Free plans have nothing to credit.
const MEMBER_MONTH: Record<string, number> = { pro: 2500, pro_plus: 4500, federal_pro: 6500 };
const COMPANY_MONTH: Record<string, number> = { professional: 24900, federal: 59900, enterprise: 59900 };
const LABEL: Record<string, string> = { pro: 'Pro', pro_plus: 'Pro Plus', federal_pro: 'Federal', professional: 'Professional', federal: 'Federal', enterprise: 'Enterprise' };

/** Called when a member or a company owner becomes verified. Credits whoever referred them — once. */
export async function rewardReferrer(referredProfileId: string) {
  const admin = createAdminClient();
  const { data: referred } = await admin.from('profiles').select('referred_by, full_name').eq('id', referredProfileId).maybeSingle();
  if (!referred?.referred_by) return;
  // Claim the reward first so a double approval can never pay twice.
  const { data: claimed } = await admin.from('profiles').update({ referral_rewarded_at: new Date().toISOString() }).eq('id', referredProfileId).is('referral_rewarded_at', null).select('id').maybeSingle();
  if (!claimed) return;
  const { data: ref } = await admin.from('profiles').select('id, role').eq('id', referred.referred_by).maybeSingle();
  if (!ref) return;

  let cents = 0, plan = 'free', customer: string | null = null;
  if (ref.role === 'employer') {
    const { data: c } = await admin.from('companies').select('plan, stripe_customer_id').eq('owner_id', ref.id).maybeSingle();
    plan = (c?.plan as string) ?? 'free'; cents = COMPANY_MONTH[plan] ?? 0; customer = (c?.stripe_customer_id as string) ?? null;
  } else {
    const [{ data: v }, { data: bc }] = await Promise.all([
      admin.from('veteran_profiles').select('plan').eq('profile_id', ref.id).maybeSingle(),
      admin.from('billing_customers').select('stripe_customer_id').eq('profile_id', ref.id).maybeSingle(),
    ]);
    plan = (v?.plan as string) ?? 'free'; cents = MEMBER_MONTH[plan] ?? 0; customer = (bc?.stripe_customer_id as string) ?? null;
  }
  const who = referred.full_name ?? 'Someone you invited';
  if (!cents || !customer) {
    await notifyMember(ref.id as string, { type: 'referral', link: '/plans', title: `${who} joined and was verified — thank you. Referral credits apply to paid plans: on a paid plan, each verified referral earns a free month of your plan.` });
    return;
  }
  await stripe().customers.createBalanceTransaction(customer, { amount: -cents, currency: 'usd', description: `Referral credit: one month of ${LABEL[plan]}` }, { idempotencyKey: `referral-${referredProfileId}` });
  await notifyMember(ref.id as string, { type: 'referral', link: ref.role === 'employer' ? '/employer/dashboard' : '/dashboard', title: `${who} was verified on your referral — a free month of ${LABEL[plan]} ($${(cents / 100).toFixed(0)}) is credited to your next bill. Thank you.` });
}
