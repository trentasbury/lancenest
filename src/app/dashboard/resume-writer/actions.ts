'use server';

import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AI_ENABLED, GUARDRAILS, aiAllowance, askClaude, hasSsn } from '@/lib/ai';

export type AiState = { text?: string; error?: string; left?: number };
const clean = (s: string) => s.replace(/<\/?(member_text|job_text)>/gi, '');

/** Turns a member's service (from their profile, plus anything they paste) into civilian résumé wording. */
export async function writeResume(_prev: AiState, formData: FormData): Promise<AiState> {
  const { user, profile } = await requireVerifiedMember('/dashboard/resume-writer');
  if (!AI_ENABLED) return { error: 'The AI résumé writer isn’t switched on yet.' };
  const { used, limit } = await aiAllowance(user.id);
  if (used >= limit) return { error: `You’ve used all ${limit} AI drafts for this month. Pro and Career Accelerator include many more.` };
  const target = String(formData.get('target') ?? '').trim().slice(0, 120);
  const extra = String(formData.get('notes') ?? '').trim().slice(0, 3000);
  const serviceId = String(formData.get('service_id') ?? '');
  if (hasSsn(extra)) return { error: 'That looks like a Social Security number. Please remove it.' };
  const { data: s } = await (await createClient()).from('military_service').select('branch, rank, duty_title, unit, start_date, end_date, description, occupation_code, occupation:military_occupations(title, civilian_categories, civilian_skills)').eq('profile_id', user.id).eq('id', serviceId).maybeSingle();
  if (!s && !extra) return { error: 'Pick one of your service entries or paste your duties first.' };
  const svc = s as unknown as { branch: string; rank: string | null; duty_title: string | null; unit: string | null; start_date: string | null; end_date: string | null; description: string | null; occupation_code: string | null; occupation: { title: string; civilian_categories: string[]; civilian_skills: string[] } | null } | null;
  const facts = svc ? [
    `Branch: ${svc.branch}`, svc.rank && `Rank: ${svc.rank}`, svc.occupation && `Military job: ${svc.occupation_code ?? ''} ${svc.occupation.title}`,
    svc.duty_title && `Billet/duty title: ${svc.duty_title}`, `Dates: ${svc.start_date ?? '?'} to ${svc.end_date ?? 'present'}`,
    svc.occupation?.civilian_categories?.length && `Related civilian roles: ${svc.occupation.civilian_categories.slice(0, 5).join(', ')}`,
    svc.occupation?.civilian_skills?.length && `Related civilian skills: ${svc.occupation.civilian_skills.slice(0, 8).join(', ')}`,
    svc.description && `What they wrote about it: ${svc.description}`,
  ].filter(Boolean).join('\n') : '';
  const system = `You are a career coach who helps U.S. service members and veterans turn military experience into a civilian résumé. Write in plain, confident civilian language with no military jargon or acronyms (spell out anything a civilian hiring manager wouldn't know). ${GUARDRAILS}`;
  const prompt = `Write résumé content for ${profile.full_name.split(' ')[0] || 'this member'}${target ? ` aiming for: ${clean(target)}` : ''}.

<member_text>
${clean(facts)}
${extra ? `\nNotes and evaluation bullets they pasted:\n${clean(extra)}` : ''}
</member_text>

Return exactly these sections, in plain text:
CIVILIAN TITLE: one line (the closest civilian job title for this experience)
SUMMARY: 2 to 3 sentences
BULLETS: 5 to 7 lines starting with "- ", each an achievement with a strong verb, using only facts and numbers given above
SKILLS: one line, 6 to 10 skills separated by commas`;
  try {
    const text = await askClaude(user.id, 'resume', system, prompt, 900);
    return { text, left: Math.max(0, limit - used - 1) };
  } catch { return { error: 'The AI writer is busy right now. Please try again in a minute.' }; }
}
