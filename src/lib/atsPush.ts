import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE } from '@/lib/email';
import { open } from '@/lib/secretBox';

/**
 * Sends a LanceNest application into the employer's own hiring system (Greenhouse, Lever or Ashby), using the
 * "apply" API each one offers for outside job boards. Only for jobs imported from that same system (so we know
 * its job id), only to the fixed official hosts, and the employer's API key is decrypted only for the call.
 */
export type AtsProvider = 'greenhouse' | 'lever' | 'ashby';
export const ATS_LABEL: Record<AtsProvider, string> = { greenhouse: 'Greenhouse', lever: 'Lever', ashby: 'Ashby' };

const ID = /^[A-Za-z0-9-]{1,80}$/;
const short = (s: string) => s.replace(/\s+/g, ' ').slice(0, 280);

type Result = { ok: true } | { ok: false; error: string };

export async function sendApplicationToAts(applicationId: string): Promise<Result> {
  const admin = createAdminClient();
  const { data: app } = await admin.from('applications')
    .select('id, profile_id, resume_id, answers, source, status, applied_at, job:jobs!inner(id, title, company_id, external_source, external_id)')
    .eq('id', applicationId).maybeSingle();
  const a = app as unknown as { id: string; profile_id: string; resume_id: string | null; answers: { q: string; a: string }[] | null; source: string; status: string; applied_at: string;
    job: { id: string; title: string; company_id: string; external_source: string | null; external_id: string | null } } | null;
  if (!a || a.source !== 'lancenest') return { ok: false, error: 'Not a LanceNest application.' };
  // Withdrawn applications are never sent.
  if (a.status === 'withdrawn' || a.status === 'saved') return { ok: false, error: 'This applicant withdrew.' };
  const { data: conn } = await admin.from('ats_connections').select('provider, board, api_key_enc, created_at').eq('company_id', a.job.company_id).maybeSingle();
  if (!conn) return { ok: false, error: 'No hiring system connected.' };
  // Only people who applied after the connection was made saw the notice that their email and résumé go to the
  // employer's own system, so earlier applicants are never sent.
  if (Date.parse(a.applied_at) < Date.parse(conn.created_at as string)) {
    return { ok: false, error: 'This person applied before your hiring system was connected, so their details stay on LanceNest. Message them here instead.' };
  }
  const provider = conn.provider as AtsProvider;
  const record = async (r: Result) => {
    await admin.from('ats_deliveries').upsert({ application_id: a.id, company_id: a.job.company_id, provider, status: r.ok ? 'sent' : 'failed', error: r.ok ? null : short(r.error), sent_at: new Date().toISOString() });
    if (!r.ok) await admin.from('ats_connections').update({ last_error: short(r.error), updated_at: new Date().toISOString() }).eq('company_id', a.job.company_id);
    return r;
  };
  if (a.job.external_source !== provider || !a.job.external_id || !ID.test(a.job.external_id)) {
    return record({ ok: false, error: `This job wasn’t imported from ${ATS_LABEL[provider]}, so there’s no matching job there.` });
  }
  const apiKey = open(conn.api_key_enc as string);
  if (!apiKey) return record({ ok: false, error: 'The saved API key couldn’t be read. Reconnect your hiring system.' });

  // The candidate: name, email, résumé, screening answers and a link to their verified LanceNest profile.
  const [{ data: prof }, { data: u }, { data: resume }] = await Promise.all([
    admin.from('profiles').select('full_name, username').eq('id', a.profile_id).maybeSingle(),
    admin.auth.admin.getUserById(a.profile_id),
    a.resume_id ? admin.from('resumes').select('storage_path, file_name, mime_type').eq('id', a.resume_id).eq('profile_id', a.profile_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const email = u?.user?.email;
  if (!prof || !email) return record({ ok: false, error: 'The applicant’s account is incomplete.' });
  const [first, ...rest] = (prof.full_name as string).trim().split(/\s+/);
  const last = rest.join(' ') || '-';
  const profileUrl = prof.username ? `${SITE}/veterans/${prof.username as string}` : SITE;
  const note = [`Applied through LanceNest. Military service verified by LanceNest. Profile: ${profileUrl}`,
    ...(a.answers ?? []).map((x) => `${x.q}\n${x.a}`)].join('\n\n').slice(0, 8000);
  let file: { bytes: Buffer; name: string; type: string } | null = null;
  if (resume?.storage_path) {
    const { data: blob } = await admin.storage.from('resumes').download(resume.storage_path as string);
    if (blob && blob.size <= 10 * 1024 * 1024) file = { bytes: Buffer.from(await blob.arrayBuffer()), name: (resume.file_name as string) || 'resume.pdf', type: (resume.mime_type as string) || 'application/pdf' };
  }

  try {
    const signal = AbortSignal.timeout(15000);
    let res: Response;
    if (provider === 'greenhouse') {
      if (!conn.board || !ID.test(conn.board as string)) return record({ ok: false, error: 'Add your Greenhouse board token.' });
      res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(conn.board as string)}/jobs/${encodeURIComponent(a.job.external_id)}`, {
        method: 'POST', signal, redirect: 'error',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}` },
        body: JSON.stringify({ first_name: first, last_name: last, email, cover_letter_text: note,
          ...(file ? { resume_content: file.bytes.toString('base64'), resume_content_filename: file.name } : { resume_text: note }) }),
      });
    } else if (provider === 'lever') {
      if (!conn.board || !ID.test(conn.board as string)) return record({ ok: false, error: 'Add your Lever site name.' });
      const form = new FormData();
      form.set('name', `${first} ${last === '-' ? '' : last}`.trim()); form.set('email', email); form.set('comments', note);
      form.set('urls[LanceNest]', profileUrl); form.set('source', 'LanceNest');
      if (file) form.set('resume', new Blob([new Uint8Array(file.bytes)], { type: file.type }), file.name);
      res = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(conn.board as string)}/${encodeURIComponent(a.job.external_id)}?key=${encodeURIComponent(apiKey)}`, { method: 'POST', signal, redirect: 'error', body: form });
    } else {
      const fields: { path: string; value: string }[] = [{ path: '_systemfield_name', value: `${first} ${last === '-' ? '' : last}`.trim() }, { path: '_systemfield_email', value: email }];
      const form = new FormData();
      if (file) { fields.push({ path: '_systemfield_resume', value: 'resume_1' }); form.set('resume_1', new Blob([new Uint8Array(file.bytes)], { type: file.type }), file.name); }
      form.set('jobPostingId', a.job.external_id); form.set('applicationForm', JSON.stringify({ fieldSubmissions: fields }));
      res = await fetch('https://api.ashbyhq.com/applicationForm.submit', { method: 'POST', signal, redirect: 'error', headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}` }, body: form });
    }
    const text = await res.text().catch(() => '');
    let json: Record<string, unknown> = {};
    try { json = JSON.parse(text) as Record<string, unknown>; } catch { /* not JSON */ }
    const failed = !res.ok || json.ok === false || json.success === false;
    if (failed) return record({ ok: false, error: `${ATS_LABEL[provider]} said ${res.status}${typeof json.error === 'string' ? `: ${json.error}` : typeof json.message === 'string' ? `: ${json.message}` : ''}` });
    await admin.from('ats_connections').update({ last_error: null, updated_at: new Date().toISOString() }).eq('company_id', a.job.company_id);
    return record({ ok: true });
  } catch (e) {
    return record({ ok: false, error: `Couldn’t reach ${ATS_LABEL[provider]} (${(e as Error).name === 'TimeoutError' ? 'timed out' : 'network error'}).` });
  }
}

/** For a new application: send it automatically when the employer turned that on. Never throws. */
export async function autoSendApplication(applicationId: string, companyId: string) {
  try {
    const { data } = await createAdminClient().from('ats_connections').select('auto_send').eq('company_id', companyId).maybeSingle();
    if (data?.auto_send) await sendApplicationToAts(applicationId);
  } catch (e) { console.error('ats auto-send failed:', (e as Error).message); }
}
