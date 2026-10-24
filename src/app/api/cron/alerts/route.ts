import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE, sendEmail } from '@/lib/email';
import { jobMatchesPlace, parseArrangements } from '@/lib/place';
import { unsubscribeLinks } from '@/lib/emailLinks';
import { sendFounderWelcomes } from '@/lib/founderWelcome';
import { notifyMember } from '@/lib/email';

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
    const federal = ['pro_plus', 'federal_pro'].includes(plan as string);   // early cleared window: Career Accelerator and above
    const matches = new Map<string, Job>();
    for (const a of byProfile.get(profile_id as string) ?? []) {
      for (const j of jobs) {
        const age = now - Date.parse(j.posted_at);
        const cleared = (j.clearance_required ?? 'none') !== 'none';
        // Everyone gets the last 24 hours; cleared roles reach non-Federal members only after the 48-hour early-access window.
        const inWindow = cleared && !federal ? age >= 48 * H && age < 72 * H : age < 24 * H;
        if (!inWindow || (a.cleared_only && !cleared)) continue;
        // Same rule as job search: a state means remote jobs from anywhere plus hybrid/on-site jobs in that state.
        if (!jobMatchesPlace(j, a.state as string | null, parseArrangements(a.arrangement as string | null))) continue;
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
  const { data: stale } = await admin.from('verification_requests').select('id, profile_id, document_path, id_document_path').eq('status', 'pending').lt('created_at', new Date(now - 30 * 24 * H).toISOString()).limit(200);
  for (const v of stale ?? []) {
    const files = [v.document_path, v.id_document_path].filter((p): p is string => typeof p === 'string' && p.length > 0);
    if (files.length) await admin.storage.from('verification-docs').remove(files);
    // 'failed' (not 'rejected') — the only closed status the table accepts; it also reopens the member's upload form.
    await admin.from('verification_requests').update({ document_path: null, id_document_path: null, status: 'failed', notes: 'Expired after 30 days without review — please upload again.', reviewed_at: new Date().toISOString() }).eq('id', v.id);
    await admin.from('admin_actions').insert({ admin_id: null, action: 'document_auto_deleted', target_type: 'verification_request', target_id: v.id, details: { reason: '30-day retention limit' } });
  }

  // ---------- Uploads that never became a request (browser closed mid-submit): older than 1 day are deleted ----------
  // This job runs once a day, so the published promise is "within 48 hours". A real submission turns into a request within seconds.
  const { data: openReqs } = await admin.from('verification_requests').select('document_path, id_document_path').eq('status', 'pending');
  const keep = new Set((openReqs ?? []).flatMap((r) => [r.document_path, r.id_document_path]).filter(Boolean) as string[]);
  const { data: folders } = await admin.storage.from('verification-docs').list('', { limit: 1000 });
  for (const folder of (folders ?? []).filter((f) => !f.id)) {
    const { data: files } = await admin.storage.from('verification-docs').list(folder.name, { limit: 100 });
    const orphans = (files ?? []).map((f) => ({ path: `${folder.name}/${f.name}`, at: Date.parse(f.created_at ?? '') }))
      .filter((f) => !keep.has(f.path) && Number.isFinite(f.at) && now - f.at > 24 * H).map((f) => f.path);
    if (orphans.length) await admin.storage.from('verification-docs').remove(orphans);
  }

  // ---------- Referral credit for referred members who have since completed their profiles ----------
  const { data: pendingRefs } = await admin.from('profiles').select('id').not('referred_by', 'is', null).in('role', ['veteran', 'admin']).gte('created_at', new Date(now - 180 * 24 * H).toISOString()).limit(500);
  if (pendingRefs?.length) {
    const { data: done } = await admin.from('referral_rewards').select('referred_id').in('referred_id', pendingRefs.map((r) => r.id as string));
    const doneSet = new Set((done ?? []).map((d) => d.referred_id as string));
    const { rewardReferrer } = await import('@/lib/referrals');
    for (const r of pendingRefs) if (!doneSet.has(r.id as string)) await rewardReferrer(r.id as string, 'member_active');
  }

  // ---------- Free transition Pro for verified members leaving within a year (catches dates set before verification) ----------
  {
    const from = new Date(now - 90 * 24 * H).toISOString().slice(0, 10);
    const to = new Date(now + 365 * 24 * H).toISOString().slice(0, 10);
    const { data: leaving } = await admin.from('veteran_profiles').select('profile_id').eq('verification_status', 'verified').eq('member_type', 'service_member')
      .gte('separation_date', from).lte('separation_date', to).limit(1000);
    if (leaving?.length) {
      const { data: had } = await admin.from('member_grants').select('profile_id').eq('kind', 'transition_pro').in('profile_id', leaving.map((l) => l.profile_id as string));
      const hadSet = new Set((had ?? []).map((h) => h.profile_id as string));
      const { grantTransitionPro } = await import('@/lib/transitionPro');
      for (const l of leaving) if (!hadSet.has(l.profile_id as string)) await grantTransitionPro(l.profile_id as string);
    }
  }

  // ---------- Expired licenses: mark them, and pause trade services that no longer have a valid license ----------
  {
    const today = new Date(now).toISOString().slice(0, 10);
    const { data: lapsed } = await admin.from('credentials').update({ status: 'expired' }).eq('status', 'verified').lt('expires_on', today).select('profile_id, kind, trade, name');
    for (const c of (lapsed ?? []) as { profile_id: string; kind: string; trade: string | null; name: string }[]) {
      if (c.kind === 'license' && c.trade) {
        const { data: still } = await admin.from('credentials').select('id').eq('profile_id', c.profile_id).eq('trade', c.trade).eq('status', 'verified').or(`expires_on.is.null,expires_on.gte.${today}`).limit(1);
        if (!still?.length) await admin.from('service_listings').update({ status: 'paused' }).eq('profile_id', c.profile_id).eq('category', c.trade).eq('status', 'active');
      }
      const { notifyMember } = await import('@/lib/email');
      await notifyMember(c.profile_id, { type: 'verification', link: '/dashboard/credentials', title: `Your ${c.kind} “${c.name}” has expired. Add the renewed one to keep it on your profile${c.trade ? ' and keep your trade services listed' : ''}.` });
    }
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
    // Every verified member (the database returns at most 1,000 rows per request, so page through them).
    const members: { profile_id: string }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: page } = await admin.from('veteran_profiles').select('profile_id').eq('verification_status', 'verified').order('profile_id').range(from, from + 999);
      members.push(...((page ?? []) as { profile_id: string }[]));
      if (!page || page.length < 1000) break;
    }
    // Members who unsubscribed from the weekly update.
    const optedOut = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const { data: page } = await admin.from('profiles').select('id').eq('email_digest', false).order('id').range(from, from + 999);
      (page ?? []).forEach((r) => optedOut.add(r.id as string));
      if (!page || page.length < 1000) break;
    }
    const digestFor = async (m: { profile_id: string }) => {
      if (optedOut.has(m.profile_id)) return;
      const [{ count: views }, { data: u }] = await Promise.all([
        admin.from('profile_views').select('viewer_id', { count: 'exact', head: true }).eq('profile_id', m.profile_id).gte('viewed_at', weekAgo),
        admin.auth.admin.getUserById(m.profile_id),
      ]);
      if (!u?.user?.email || (!(views ?? 0) && !(newJobs ?? 0))) return;
      await sendEmail(u.user.email, { subject: 'Your week on LanceNest', preheader: `${newJobs ?? 0} new jobs · ${views ?? 0} profile views`, tone: 'notice', badge: 'Weekly update',
        heading: 'Your week on LanceNest', paragraphs: [`${newJobs ?? 0} new jobs were posted by verified employers this week.`, `${views ?? 0} people viewed your profile.`, 'Your recommended jobs are matched to your whole background — take a look.'],
        cta: { label: 'See jobs for you', url: `${SITE}/jobs` },
        unsubscribe: { ...unsubscribeLinks(SITE, m.profile_id, 'digest'), reason: 'You’re getting this weekly update as a LanceNest member.' } });
      digests++;
    };
    // Ten at a time, so the job finishes well within its time limit as membership grows.
    for (let i = 0; i < members.length; i += 10) await Promise.all(members.slice(i, i + 10).map((m) => digestFor(m).catch(() => undefined)));
  }

  // ---------- Applicants who haven't heard back in 30 days: one plain notice each ----------
  let staleNotices = 0;
  {
    const { data: stale } = await admin.from('applications').select('id, profile_id, job:jobs!inner(title, status)')
      .eq('source', 'lancenest').in('status', ['applied', 'viewed'])
      .lt('applied_at', new Date(now - 30 * 24 * H).toISOString()).gte('applied_at', new Date(now - 31 * 24 * H).toISOString()).limit(2000);
    const rows = ((stale ?? []) as unknown as { id: string; profile_id: string; job: { title: string; status: string } }[]).filter((r) => r.job.status === 'open');
    if (rows.length) {
      await admin.from('notifications').insert(rows.map((r) => ({ profile_id: r.profile_id, type: 'application_status', link: '/dashboard/applications',
        title: `No update yet on “${r.job.title}” after 30 days. It’s still open, so it’s worth applying to similar roles too.` })));
      staleNotices = rows.length;
    }
  }

  // ---------- Free Pro (transition or partner) ends in 7 days: offer 25% off a first year ----------
  {
    const { data: ending } = await admin.from('veteran_profiles').select('profile_id, granted_plan')
      .not('granted_plan', 'is', null).gte('pro_granted_until', new Date(now + 6 * 24 * H).toISOString()).lt('pro_granted_until', new Date(now + 7 * 24 * H).toISOString()).limit(1000);
    for (const e of ending ?? []) {
      await notifyMember(e.profile_id as string, { type: 'plan', link: '/plans',
        title: 'Your free Pro ends in 7 days. Keep it for 25% off your first year.',
        email: { subject: 'Your free LanceNest Pro ends in 7 days', preheader: 'Keep it for 25% off your first year.', tone: 'notice', badge: 'Pro',
          heading: 'Keep Pro for 25% off your first year.', paragraphs: ['Your free months of Pro end in 7 days. Choose a yearly plan before then, or within 60 days after, and your first year is 25% off.', 'Nothing changes if you do nothing: you move back to Free, which stays free.'],
          cta: { label: 'Keep Pro', url: `${SITE}/plans` } } }).catch(() => undefined);
    }
  }

  // ---------- Mondays: tell employers which applicants have waited more than 7 days ----------
  let employerNudges = 0;
  if (new Date(now).getUTCDay() === 1) {
    const { data: waiting } = await admin.from('applications').select('id, job:jobs!inner(id, status, company:companies!inner(id, owner_id, name))')
      .eq('source', 'lancenest').eq('status', 'applied').lt('applied_at', new Date(now - 7 * 24 * H).toISOString()).limit(5000);
    const byCompany = new Map<string, { owner: string; name: string; count: number; jobs: Set<string> }>();
    for (const w of (waiting ?? []) as unknown as { job: { id: string; status: string; company: { id: string; owner_id: string | null; name: string } } }[]) {
      if (w.job.status !== 'open' || !w.job.company.owner_id) continue;
      const e = byCompany.get(w.job.company.id) ?? { owner: w.job.company.owner_id, name: w.job.company.name, count: 0, jobs: new Set<string>() };
      e.count++; e.jobs.add(w.job.id); byCompany.set(w.job.company.id, e);
    }
    for (const e of byCompany.values()) {
      await notifyMember(e.owner, { type: 'applicants_waiting', link: '/employer/dashboard',
        title: `${e.count} applicant${e.count === 1 ? ' has' : 's have'} waited more than 7 days for an answer.`,
        email: { subject: `${e.count} applicant${e.count === 1 ? ' is' : 's are'} waiting on ${e.name}`, preheader: 'A quick yes, no or “we’re reviewing” keeps your response badge.', tone: 'notice', badge: 'Applicants waiting',
          heading: `${e.count} applicant${e.count === 1 ? ' is' : 's are'} still waiting to hear from you`,
          paragraphs: [`Across ${e.jobs.size} open job${e.jobs.size === 1 ? '' : 's'}, ${e.count} verified member${e.count === 1 ? ' has' : 's have'} waited more than a week.`,
            'Opening an application marks it viewed. Employers who answer within 14 days show a “usually responds” badge on their jobs, and those jobs get more applicants.'],
          cta: { label: 'Review applicants', url: `${SITE}/employer/dashboard` } } }).catch(() => undefined);
      employerNudges++;
    }
  }

  // ---------- The founder's personal welcome, the morning after verification ----------
  const founderWelcomes = await sendFounderWelcomes(now).catch((err) => { console.error('founder welcomes failed:', err); return 0; });

  return NextResponse.json({ memberEmails, employerEmails, digests, founderWelcomes, staleNotices, employerNudges });
}
