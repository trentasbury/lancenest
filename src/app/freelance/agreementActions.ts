'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import { AGREEMENT_FIELD, recordAgreement, type AgreementSide } from '@/lib/platformAgreement';

/** The one-time "book it on LanceNest" agreement, on its own (for pages where it sits above several buttons). */
export async function agreeToBookOnPlatform(side: AgreementSide, back: string, formData: FormData) {
  const session = await getSessionProfile();
  if (!session) redirect('/login');
  const path = /^\/freelance(\/[A-Za-z0-9/_-]*)?$/.test(back) ? back : '/freelance';
  const role = session.profile?.role;
  const allowed = side === 'freelancer' ? role === 'veteran' : ['employer', 'client', 'admin'].includes(role ?? '');
  if (!allowed) redirect(path);
  if (formData.get(AGREEMENT_FIELD) !== 'on') redirect(`${path}?error=agree`);
  await recordAgreement(session.user.id, side);
  revalidatePath(path);
  redirect(path);
}
