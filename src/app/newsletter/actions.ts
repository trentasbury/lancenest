'use server';

import { redirect } from 'next/navigation';
import { subscribe } from '@/lib/newsletter';

export async function subscribeNewsletter(formData: FormData) {
  if (String(formData.get('website') ?? '')) redirect('/newsletter?sent=1'); // filled-in hidden field: a bot
  const result = await subscribe(String(formData.get('email') ?? ''), String(formData.get('source') ?? '').slice(0, 60) || null);
  redirect(`/newsletter?${result === 'invalid' ? 'error=email' : result === 'busy' ? 'error=busy' : result === 'already' ? 'already=1' : 'sent=1'}`);
}
