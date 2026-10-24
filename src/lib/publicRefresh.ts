import 'server-only';
import { revalidatePath, revalidateTag } from 'next/cache';

/** After any job change: refresh the public job index and every page built from it. */
export function refreshPublicJobs() {
  revalidateTag('public-jobs', 'max');
  revalidatePath('/open-jobs');
  revalidatePath('/open-jobs/[slug]', 'page');
  revalidatePath('/bases/[slug]', 'page');
  revalidatePath('/careers/[branch]/[code]', 'page');
}
