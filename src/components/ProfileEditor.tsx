'use client';

import { useState, useTransition } from 'react';
import { BRANCHES, CLEARANCE_STATUS, CLEARANCES, COMPONENTS, POLYGRAPH } from '@/lib/military';
import { saveFullProfile, type ProfilePayload } from '@/app/dashboard/profile/saveAll';

const blankSvc = { branch: 'Army', component: 'active', rank: '', duty_title: '', unit: '', occupation_code: '', start_year: '', end_year: '', description: '', deployments: '' };
const blankExp = { company: '', position: '', start_year: '', end_year: '', description: '' };
const blankEdu = { school: '', degree: '', field: '', graduation_year: '' };

/** The whole profile in one place: everything pre-filled, edit anything, one Save. */
export default function ProfileEditor({ initial }: { initial: ProfilePayload }) {
  const [p, setP] = useState<ProfilePayload>(initial);
  const [skill, setSkill] = useState('');
  const [status, setStatus] = useState<{ ok?: boolean; msg?: string }>({});
  const [saving, startTransition] = useTransition();
  const dirty = () => setStatus({});
  const setBasics = (k: keyof ProfilePayload['basics'], v: string | boolean) => { dirty(); setP((x) => ({ ...x, basics: { ...x.basics, [k]: v } })); };
  function setRow<K extends 'service' | 'experience' | 'education'>(list: K, i: number, k: string, v: string) {
    dirty(); setP((x) => ({ ...x, [list]: (x[list] as Record<string, string>[]).map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));
  }
  const addRow = (list: 'service' | 'experience' | 'education', row: object) => { dirty(); setP((x) => ({ ...x, [list]: [...(x[list] as object[]), { ...row }] })); };
  const removeRow = (list: 'service' | 'experience' | 'education', i: number) => { dirty(); setP((x) => ({ ...x, [list]: (x[list] as object[]).filter((_, j) => j !== i) })); };
  const addSkill = () => { const n = skill.trim(); if (n && !p.skills.some((x) => x.toLowerCase() === n.toLowerCase())) { dirty(); setP((x) => ({ ...x, skills: [...x.skills, n] })); } setSkill(''); };
  const save = () => startTransition(async () => { const r = await saveFullProfile(p); setStatus(r.ok ? { ok: true, msg: 'Profile saved.' } : { ok: false, msg: r.error }); });
  const F = 'field text-sm', L = 'field-label';
  const years = (row: { start_year: string; end_year: string }, list: 'service' | 'experience', i: number, endLabel = 'End year (blank = current)') => (
    <>
      <div><label className={L}>Start year</label><input inputMode="numeric" maxLength={4} value={row.start_year} onChange={(e) => setRow(list, i, 'start_year', e.target.value)} className={F} /></div>
      <div><label className={L}>{endLabel}</label><input inputMode="numeric" maxLength={4} value={row.end_year} onChange={(e) => setRow(list, i, 'end_year', e.target.value)} className={F} /></div>
    </>
  );
  return (
    <div className="space-y-6 pb-24">
      <section className="card space-y-3 p-6">
        <h2 className="eyebrow">About you</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className={L}>Full name</label><input value={p.basics.full_name} onChange={(e) => setBasics('full_name', e.target.value)} className={F} /></div>
          <div className="sm:col-span-2"><label className={L}>Headline</label><input value={p.basics.headline} maxLength={140} onChange={(e) => setBasics('headline', e.target.value)} placeholder="e.g. Logistics Manager · USMC Veteran · Secret clearance" className={F} /></div>
          <div><label className={L}>City</label><input value={p.basics.city} onChange={(e) => setBasics('city', e.target.value)} className={F} /></div>
          <div><label className={L}>State</label><input value={p.basics.state} onChange={(e) => setBasics('state', e.target.value)} placeholder="FL" className={F} /></div>
          <div className="sm:col-span-2"><label className={L}>About</label><textarea rows={4} maxLength={3000} value={p.basics.about} onChange={(e) => setBasics('about', e.target.value)} className={F} /></div>
          <div><label className={L}>Availability</label><select value={p.basics.availability} onChange={(e) => setBasics('availability', e.target.value)} className={F}><option value="open_now">Open to work now</option><option value="open_soon">Open soon (transitioning or exploring)</option><option value="not_looking">Not looking right now</option></select></div>
          <div><label className={L}>Target pay (optional)</label><input value={p.basics.target_pay} maxLength={60} onChange={(e) => setBasics('target_pay', e.target.value)} placeholder="e.g. $85–95K or $60/hr" className={F} /></div>
          <div className="sm:col-span-2"><label className={L}>Roles you want next (comma-separated)</label><input value={p.basics.desired_titles} onChange={(e) => setBasics('desired_titles', e.target.value)} placeholder="e.g. Project Manager, HVAC Technician" className={F} />
            <p className="mt-1 text-xs text-muted">Changing fields? List the roles you want — job matches use them as much as your past titles.</p></div>
          <div><label className={L}>Security clearance (self-reported)</label><select value={p.basics.clearance_level} onChange={(e) => setBasics('clearance_level', e.target.value)} className={F}>{CLEARANCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          {p.basics.clearance_level !== 'none' && <>
            <div><label className={L}>Clearance status</label><select value={p.basics.clearance_status} onChange={(e) => setBasics('clearance_status', e.target.value)} className={F}><option value="">Choose…</option>{CLEARANCE_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div><label className={L}>Polygraph</label><select value={p.basics.polygraph} onChange={(e) => setBasics('polygraph', e.target.value)} className={F}>{POLYGRAPH.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          </>}
          <p className="text-xs text-muted sm:col-span-2 sm:order-last">List only a clearance you currently hold or held within the last two years. Employers confirm eligibility through official systems, and misrepresenting a clearance leads to removal.</p>
          <div className="flex flex-col justify-end gap-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={p.basics.willing_to_relocate} onChange={(e) => setBasics('willing_to_relocate', e.target.checked)} className="accent-navy" />Open to relocating</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={p.basics.is_public} onChange={(e) => setBasics('is_public', e.target.checked)} className="accent-navy" />Visible to verified employers</label>
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="eyebrow">Military career</h2>
        <p className="text-xs text-muted">Add each assignment — every duty station, branch, or component (Active, Guard, Reserve). OPSEC: no classified details, locations of deployments, or unit movements.</p>
        {p.service.map((x, i) => (
          <div key={i} className="space-y-3 rounded-[4px] border border-line p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className={L}>Branch</label><select value={x.branch} onChange={(e) => setRow('service', i, 'branch', e.target.value)} className={F}>{BRANCHES.map((b) => <option key={b}>{b}</option>)}</select></div>
              <div><label className={L}>Component</label><select value={x.component} onChange={(e) => setRow('service', i, 'component', e.target.value)} className={F}>{COMPONENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div><label className={L}>MOS / rating / AFSC</label><input value={x.occupation_code} onChange={(e) => setRow('service', i, 'occupation_code', e.target.value)} placeholder="e.g. 0311, 68W, 5S0X1" className={F} /></div>
              <div><label className={L}>Billet / duty title</label><input value={x.duty_title} onChange={(e) => setRow('service', i, 'duty_title', e.target.value)} className={F} /></div>
              <div><label className={L}>Rank</label><input value={x.rank} onChange={(e) => setRow('service', i, 'rank', e.target.value)} className={F} /></div>
              <div><label className={L}>Unit</label><input value={x.unit} onChange={(e) => setRow('service', i, 'unit', e.target.value)} className={F} /></div>
              {years(x, 'service', i)}
              <div><label className={L}>Deployments</label><input inputMode="numeric" value={x.deployments} onChange={(e) => setRow('service', i, 'deployments', e.target.value)} className={F} /></div>
            </div>
            <div><label className={L}>What you did</label><textarea rows={3} maxLength={2000} value={x.description} onChange={(e) => setRow('service', i, 'description', e.target.value)} placeholder="Led, managed, maintained — and the results" className={F} /></div>
            <button type="button" onClick={() => removeRow('service', i)} className="text-xs text-muted hover:text-signal">Remove this assignment</button>
          </div>
        ))}
        <button type="button" onClick={() => addRow('service', blankSvc)} className="btn btn-outline text-sm">+ Add another assignment</button>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="eyebrow">Professional career</h2>
        {p.experience.map((x, i) => (
          <div key={i} className="space-y-3 rounded-[4px] border border-line p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={L}>Title</label><input value={x.position} onChange={(e) => setRow('experience', i, 'position', e.target.value)} className={F} /></div>
              <div><label className={L}>Company</label><input value={x.company} onChange={(e) => setRow('experience', i, 'company', e.target.value)} className={F} /></div>
              {years(x, 'experience', i)}
            </div>
            <div><label className={L}>Description</label><textarea rows={3} maxLength={2000} value={x.description} onChange={(e) => setRow('experience', i, 'description', e.target.value)} className={F} /></div>
            <button type="button" onClick={() => removeRow('experience', i)} className="text-xs text-muted hover:text-signal">Remove this job</button>
          </div>
        ))}
        <button type="button" onClick={() => addRow('experience', blankExp)} className="btn btn-outline text-sm">+ Add a job</button>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="eyebrow">Education</h2>
        {p.education.map((x, i) => (
          <div key={i} className="grid gap-3 rounded-[4px] border border-line p-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={L}>School</label><input value={x.school} onChange={(e) => setRow('education', i, 'school', e.target.value)} className={F} /></div>
            <div><label className={L}>Degree or certificate</label><input value={x.degree} onChange={(e) => setRow('education', i, 'degree', e.target.value)} className={F} /></div>
            <div><label className={L}>Field</label><input value={x.field} onChange={(e) => setRow('education', i, 'field', e.target.value)} className={F} /></div>
            <div><label className={L}>Graduation year</label><input inputMode="numeric" maxLength={4} value={x.graduation_year} onChange={(e) => setRow('education', i, 'graduation_year', e.target.value)} className={F} /></div>
            <div className="flex items-end"><button type="button" onClick={() => removeRow('education', i)} className="text-xs text-muted hover:text-signal">Remove</button></div>
          </div>
        ))}
        <button type="button" onClick={() => addRow('education', blankEdu)} className="btn btn-outline text-sm">+ Add education</button>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="eyebrow">Skills</h2>
        <div className="flex flex-wrap gap-2">{p.skills.map((n) => <span key={n} className="pill">{n}<button type="button" aria-label={`Remove ${n}`} onClick={() => { dirty(); setP((x) => ({ ...x, skills: x.skills.filter((y) => y !== n) })); }} className="ml-1.5 text-muted hover:text-signal">×</button></span>)}</div>
        <div className="flex gap-2"><input value={skill} onChange={(e) => setSkill(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} placeholder="e.g. Logistics, Team leadership, Enterprise software" className={F} /><button type="button" onClick={addSkill} className="btn btn-outline shrink-0 text-sm">Add</button></div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ivory/95 py-3 backdrop-blur" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="container-page flex max-w-3xl items-center justify-between gap-3">
          <p className={`text-sm ${status.ok ? 'text-olive' : status.msg ? 'text-signal' : 'text-muted'}`}>{status.msg ?? 'Changes are saved when you press Save.'}</p>
          <button type="button" onClick={save} disabled={saving} className="btn btn-primary shrink-0">{saving ? 'Saving…' : 'Save profile'}</button>
        </div>
      </div>
    </div>
  );
}
