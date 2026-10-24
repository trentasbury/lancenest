'use server';

import { requireVerifiedMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AI_ENABLED, GUARDRAILS, aiAllowance, askClaude } from '@/lib/ai';

export type FitState = { text?: string; error?: string };
const clean = (s: string | null | undefined) => (s ?? '').replace(/<\/?(member_text|job_text)>/gi, '').slice(0, 2500);

/** Explains, for this member only, why a job fits their background and what to address. */
export async function explainFit(slug: string, _prev: FitState): Promise<FitState> {
  const { user } = await requireVerifiedMember(`/jobs/${slug}`);
  if (!AI_ENABLED) return { error: 'This isn’t switched on yet.' };
  const { used, limit } = await aiAllowance(user.id);
  if (used >= limit) return { error: `You’ve used all ${limit} AI answers for this month.` };
  const db = await createClient();
  const [{ data: job }, { data: me }, { data: svc }, { data: exp }, { data: sk }] = await Promise.all([
    db.from('jobs').select('title, description, responsibilities, qualifications, preferred_qualifications, clearance_required').eq('slug', slug).maybeSingle(),
    db.from('profiles').select('headline').eq('id', user.id).maybeSingle(),
    db.from('military_service').select('branch, rank, duty_title, description, occupation_code, occupation:military_occupations(title, civilian_skills)').eq('profile_id', user.id).limit(4),
    db.from('experience').select('company, position, description').eq('profile_id', user.id).limit(4),
    db.from('profile_skills').select('skill:skills(name)').eq('profile_id', user.id).limit(30),
  ]);
  if (!job) return { error: 'That job isn’t available.' };
  const profile = [
    me?.headline && `Headline: ${me.headline}`,
    ...((svc ?? []) as unknown as { branch: string; rank: string | null; duty_title: string | null; description: string | null; occupation_code: string | null; occupation: { title: string; civilian_skills: string[] } | null }[])
      .map((s) => `Military: ${[s.branch, s.rank, s.occupation_code, s.occupation?.title, s.duty_title].filter(Boolean).join(', ')}. ${s.description ?? ''} Skills: ${(s.occupation?.civilian_skills ?? []).slice(0, 6).join(', ')}`),
    ...((exp ?? []) as { company: string; position: string; description: string | null }[]).map((e) => `Civilian: ${e.position} at ${e.company}. ${e.description ?? ''}`),
    `Skills: ${((sk ?? []) as unknown as { skill: { name: string } | null }[]).map((r) => r.skill?.name).filter(Boolean).join(', ')}`,
  ].filter(Boolean).join('\n');
  const system = `You help veterans see how their background fits a civilian job, honestly. Be specific, brief and encouraging, and never overstate a fit. ${GUARDRAILS}`;
  const prompt = `<job_text>\nTitle: ${clean(job.title)}\n${clean(job.description)}\nResponsibilities: ${clean(job.responsibilities)}\nQualifications: ${clean(job.qualifications)}\nPreferred: ${clean(job.preferred_qualifications)}\n</job_text>\n\n<member_text>\n${clean(profile)}\n</member_text>\n\nAnswer in plain text with these three headings:\nWHY YOU FIT: 3 short bullets starting with "- ", each tied to something in the member's background\nGAPS TO ADDRESS: 1 or 2 short bullets\nSAY THIS IN THE INTERVIEW: 2 short bullets`;
  try { return { text: await askClaude(user.id, 'job_fit', system, prompt, 600) }; } catch { return { error: 'This is busy right now. Please try again in a minute.' }; }
}
