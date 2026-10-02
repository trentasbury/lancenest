import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE, sendEmail } from '@/lib/email';
import { US_STATES } from '@/lib/states';

type Job = { id: string; slug: string; title: string; description: string | null; location: string | null; work_arrangement: string | null; clearance_required: string | null; posted_at: string; company: { name: string } | null };
const H = 3600000;

/** Daily (Vercel Cron): job alerts for paid members, and new-match alerts for employers' saved searches. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new NextResponse('Unauthorized', { status: 401 });
  const admin = createAdminClient();
  const now = Date.now();
  let memberEmails = 0, employerEmails = 0;

  // ---------- Member job alerts ----------
  const { data: jobsData } = await admin.from('jobs').select('id, slug, title, description, location, work_arrangement, clearance_required, posted_at, company:companies(name)')
    .eq('status', 'open').gte('posted_at', new Date(now - 72 * H).toISOString());
  const jobs = (jobsData ?? []) as unknown as Job[];
  const { data: alerts } = await admin.from('job_alerts').select('id, profile_id, keywords, state, arrangement, cleared_only');
  const byProfile = new Map<string, NonNullable<typeof alerts>>();
  (alerts ?? []).forEach((a) => byProfile.set(a.profile_id as string, [...(byProfile.get(a.profile_id as string) ?? []), a]));
  const { data: plans } = byProfile.size ? await admin.from('veteran_profiles').select('profile_id, plan').in('profile_id', Array.from(byProfile.keys())).neq('plan', 'free') : { data: [] };
  for (const { profile_id, plan } of plans ?? []) {
    const federal = plan !== 'free';   // all paid members get the 48-hour early window
    const matches = new Map<string, Job>();
    for (const a of byProfile.get(profile_id as string) ?? []) {
      for (const j of jobs) {
        const age = now - Date.parse(j.posted_at);
        const cleared = (j.clearance_required ?? 'none') !== 'none';
        // Everyone gets the last 24 hours; cleared roles reach non-Federal members only after the 48-hour early-access window.
        const inWindow = cleared && !federal ? age >= 48 * H && age < 72 * H : age < 24 * H;
        if (!inWindow || (a.cleared_only && !cleared)) continue;
        if (a.arrangement && j.work_arrangement !== a.arrangement) continue;
        if (a.state) { const st = US_STATES.find(([c]) => c === a.state); const loc = (j.location ?? '').toLowerCase(); if (!st || !(loc.includes(`, ${st[0].toLowerCase()}`) || loc.includes(st[1].toLowerCase()))) continue; }
        if (a.keywords) { const hay = `${j.title} ${j.description ?? ''}`.toLowerCase(); if (!a.keywords.toLowerCase().split(/[\s,]+/).filter(Boolean).some((k: string) => hay.includes(k))) continue; }
        matches.set(j.id, j);
      }
    }
    if (!matches.size) continue;
    const { data: u } = await admin.auth.admin.getUserById(profile_id as string);
    if (!u?.user?.email) continue;
    const list = Array.from(matches.values()).slice(0, 10);
    await sendEmail(u.user.email, { subject: `${list.length} new job${list.length === 1 ? '' : 's'} for you on LanceNest`, preheader: list.map((j) => j.title).slice(0, 3).join(' · '), tone: 'notice', badge: 'Job alert',
      heading: 'New jobs that match your alerts', paragraphs: list.map((j) => `${j.title} — ${j.company?.name ?? ''}${j.location ? `, ${j.location}` : ''}${(j.clearance_required ?? 'none') !== 'none' ? ' (clearance required)' : ''}: ${SITE}/jobs/${j.slug}`),
      cta: { label: 'See all jobs', url: `${SITE}/jobs` } });
    await admin.from('job_alerts').update({ last_sent_at: new Date().toISOString() }).eq('profile_id', profile_id);
    memberEmails++;
  }

  // ---------- Employer saved-search alerts: newly verified members ----------
  const { data: fresh } = await admin.from('verification_requests').select('profile_id').eq('status', 'verified').gte('reviewed_at', new Date(now - 24 * H).toISOString());
  const newIds = Array.from(new Set((fresh ?? []).map((r) => r.profile_id as string)));
  if (newIds.length) {
    const [{ data: vets }, { data: profs }, { data: service }, { data: skills }] = await Promise.all([
      admin.from('veteran_profiles').select('profile_id, state, clearance_level, willing_to_relocate, separation_date, open_to_transition_hiring').in('profile_id', newIds),
      admin.from('profiles').select('id, full_name, username, headline, banned').in('id', newIds),
      admin.from('military_service').select('profile_id, branch, occupation_code').in('profile_id', newIds),
      admin.from('profile_skills').select('profile_id, skills(name)').in('profile_id', newIds),
    ]);
    const ORDER = ['none', 'public_trust', 'confidential', 'secret', 'top_secret', 'ts_sci'];
    const { data: searches } = await admin.from('saved_searches').select('id, company_id, name, params, company:companies(owner_id, plan, is_verified)');
    for (const ss of (searches ?? []) as unknown as { id: string; company_id: string; name: string; params: Record<string, string>; company: { owner_id: string; plan: string; is_verified: boolean } | null }[]) {
      if (!ss.company?.is_verified || !['professional', 'federal', 'enterprise'].includes(ss.company.plan)) continue;
      const p = ss.params ?? {};
      const hits = (profs ?? []).filter((pr) => {
        if (pr.banned) return false;
        const v = (vets ?? []).find((x) => x.profile_id === pr.id);
        const svc = (service ?? []).filter((x) => x.profile_id === pr.id);
        const sk = (skills ?? []).filter((x) => x.profile_id === pr.id).map((x) => ((x.skills as unknown as { name: string } | null)?.name ?? '').toLowerCase());
        if (p.q && !`${pr.full_name} ${pr.headline ?? ''}`.toLowerCase().includes(p.q.toLowerCase())) return false;
        if (p.branch && !svc.some((x) => x.branch === p.branch)) return false;
        if (p.mos && !svc.some((x) => (x.occupation_code ?? '').toLowerCase() === p.mos.toLowerCase())) return false;
        if (p.skill && !sk.some((n) => n.includes(p.skill.toLowerCase()))) return false;
        if (p.state && (v?.state ?? '').toLowerCase() !== p.state.toLowerCase()) return false;
        if (p.relocate && !v?.willing_to_relocate) return false;
        if (p.clearance && ['federal', 'enterprise'].includes(ss.company!.plan) && ORDER.indexOf(v?.clearance_level ?? 'none') < ORDER.indexOf(p.clearance)) return false;
        if (p.transitioning && !(v?.open_to_transition_hiring && v.separation_date && Date.parse(v.separation_date) - now < 365 * 24 * H)) return false;
        return true;
      });
      if (!hits.length) continue;
      const { data: owner } = await admin.auth.admin.getUserById(ss.company.owner_id);
      if (!owner?.user?.email) continue;
      await sendEmail(owner.user.email, { subject: `${hits.length} new verified candidate${hits.length === 1 ? '' : 's'} for “${ss.name}”`, preheader: 'New verified service members match your saved search.', tone: 'success', badge: 'Saved search',
        heading: `New matches for “${ss.name}”`, paragraphs: hits.slice(0, 10).map((h) => `${h.full_name}${h.headline ? ` — ${h.headline}` : ''}${h.username ? `: ${SITE}/veterans/${h.username}` : ''}`),
        cta: { label: 'Open candidate search', url: `${SITE}/employer/candidates?${new URLSearchParams(p)}` } });
      await admin.from('saved_searches').update({ last_sent_at: new Date().toISOString() }).eq('id', ss.id);
      employerEmails++;
    }
  }
  // ---------- Verification documents never reviewed: delete after 30 days (logged) ----------
  const { data: stale } = await admin.from('verification_requests').select('id, profile_id, document_path').eq('status', 'pending').not('document_path', 'is', null).lt('created_at', new Date(now - 30 * 24 * H).toISOString()).limit(200);
  for (const v of stale ?? []) {
    await admin.storage.from('verification-docs').remove([v.document_path as string]);
    await admin.from('verification_requests').update({ document_path: null, status: 'rejected', notes: 'Expired after 30 days without review — please upload again.', reviewed_at: new Date().toISOString() }).eq('id', v.id);
    await admin.from('admin_actions').insert({ admin_id: null, action: 'document_auto_deleted', target_type: 'verification_request', target_id: v.id, details: { reason: '30-day retention limit' } });
  }

  // ---------- Referral credit for referred members who have since completed their profiles ----------
  const { data: pendingRefs } = await admin.from('profiles').select('id').not('referred_by', 'is', null).in('role', ['veteran', 'admin']).gte('created_at', new Date(now - 180 * 24 * H).toISOString()).limit(500);
  if (pendingRefs?.length) {
    const { data: done } = await admin.from('referral_rewards').select('referred_id').in('referred_id', pendingRefs.map((r) => r.id as string));
    const doneSet = new Set((done ?? []).map((d) => d.referred_id as string));
    const { rewardReferrer } = await import('@/lib/referrals');
    for (const r of pendingRefs) if (!doneSet.has(r.id as string)) await rewardReferrer(r.id as string, 'member_active');
  }

  // ---------- Expire free Pro months earned through referrals ----------
  const { data: expired } = await admin.from('veteran_profiles').select('profile_id').not('granted_plan', 'is', null).lt('pro_granted_until', new Date().toISOString());
  if (expired?.length) {
    const { recomputeVeteran } = await import('@/lib/billing');
    for (const e of expired) await recomputeVeteran(e.profile_id as string);
  }

  // ---------- Monday weekly digest for verified members ----------
  let digests = 0;
  if (new Date().getUTCDay() === 1) {
    const weekAgo = new Date(now - 7 * 24 * H).toISOString();
    const { count: newJobs } = await admin.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'open').gte('posted_at', weekAgo);
    const { data: members } = await admin.from('veteran_profiles').select('profile_id').eq('verification_status', 'verified').limit(5000);
    for (const m of members ?? []) {
      const [{ count: views }, { data: u }] = await Promise.all([
        admin.from('profile_views').select('viewer_id', { count: 'exact', head: true }).eq('profile_id', m.profile_id).gte('viewed_at', weekAgo),
        admin.auth.admin.getUserById(m.profile_id as string),
      ]);
      if (!u?.user?.email || (!(views ?? 0) && !(newJobs ?? 0))) continue;
      await sendEmail(u.user.email, { subject: 'Your week on LanceNest', preheader: `${newJobs ?? 0} new jobs · ${views ?? 0} profile views`, tone: 'notice', badge: 'Weekly update',
        heading: 'Your week on LanceNest', paragraphs: [`${newJobs ?? 0} new jobs were posted by verified employers this week.`, `${views ?? 0} people viewed your profile.`, 'Your recommended jobs are matched to your whole background — take a look.'],
        cta: { label: 'See jobs for you', url: `${SITE}/jobs` } });
      digests++;
    }
  }
  return NextResponse.json({ memberEmails, employerEmails, digests });
}
