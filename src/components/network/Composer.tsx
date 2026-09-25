'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createPost } from '@/app/network/actions';
import Avatar from './Avatar';

type Opt = readonly [string, string];

export default function Composer({
  userId, name, postTypes, milestonesByType, visibility,
}: {
  userId: string; name: string; postTypes: readonly Opt[]; milestonesByType: Record<string, [string, string][]>;
  visibility: readonly (readonly [string, string, string])[];
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('general');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const milestones = milestonesByType[type] ?? [];

  function pickFiles(list: FileList | null) {
    const chosen = Array.from(list ?? []).slice(0, 4);
    const bad = chosen.find((f) => !/^image\/(jpeg|png|webp|gif)$/.test(f.type) || f.size > 8 * 1024 * 1024);
    if (bad) {
      setError('Photos must be JPG, PNG, WebP, or GIF and under 8 MB each (4 max).');
      return;
    }
    setError('');
    setFiles(chosen);
  }

  function submit(formData: FormData) {
    setError('');
    start(async () => {
      try {
        // Photos go straight to storage (into the member's own folder), then the post references them.
        const supabase = createClient();
        const paths: string[] = [];
        for (const f of files) {
          const ext = f.type.split('/')[1].replace('jpeg', 'jpg');
          const path = `${userId}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage.from('post-media').upload(path, f, { contentType: f.type });
          if (upErr) throw new Error('upload');
          paths.push(path);
        }
        formData.set('media', JSON.stringify(paths));
        const result = await createPost(formData);
        if (result.error) {
          setError(result.error);
          return;
        }
        formRef.current?.reset();
        setFiles([]);
        setType('general');
        setOpen(false);
        router.refresh();
      } catch {
        setError('A photo didn’t upload. Please try again.');
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="card flex w-full items-center gap-3 p-4 text-left transition-colors hover:border-brass/60">
        <Avatar name={name} />
        <span className="flex-1 rounded-full border border-line bg-paper px-4 py-3 text-sm text-muted">Share an accomplishment or update…</span>
      </button>
    );
  }

  return (
    <form ref={formRef} action={submit} className="card space-y-4 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <p className="font-serif text-xl font-semibold">Share with your network</p>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:text-ink">Cancel</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="post_type" className="field-label">Post type</label>
          <select id="post_type" name="post_type" value={type} onChange={(e) => setType(e.target.value)} className="field">
            {postTypes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {milestones.length > 0 && (
          <div>
            <label htmlFor="milestone" className="field-label">Milestone</label>
            <select id="milestone" name="milestone" defaultValue="" className="field">
              <option value="">None — just an update</option>
              {milestones.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )}
      </div>
      <div>
        <label htmlFor="body" className="field-label">What would you like to share?</label>
        <textarea id="body" name="body" rows={4} maxLength={3000} autoFocus placeholder="Tell your network what happened. Mention someone with @username." className="field" />
      </div>
      {type !== 'general' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="title" className="field-label">Title / position</label><input id="title" name="title" maxLength={140} placeholder="e.g. Program Manager, PMP, MBA" className="field" /></div>
          <div><label htmlFor="organization" className="field-label">Company / school / organization</label><input id="organization" name="organization" maxLength={140} className="field" /></div>
          <div><label htmlFor="location" className="field-label">Location</label><input id="location" name="location" maxLength={120} className="field" /></div>
          <div><label htmlFor="event_date" className="field-label">Date</label><input id="event_date" name="event_date" type="date" className="field" /></div>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="photos" className="field-label">Photos (optional, up to 4)</label>
          <input id="photos" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(e) => pickFiles(e.target.files)} className="field text-sm file:mr-3 file:rounded-[3px] file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-ivory" />
          {files.length > 0 && <p className="mt-1 text-xs text-muted">{files.length} photo{files.length > 1 ? 's' : ''} selected</p>}
        </div>
        <div className="sm:w-56">
          <label htmlFor="visibility" className="field-label">Who can see this</label>
          <select id="visibility" name="visibility" defaultValue="network" className="field">
            {visibility.map(([v, l, hint]) => <option key={v} value={v} title={hint}>{l}</option>)}
          </select>
        </div>
      </div>
      {error && <p role="alert" className="rounded-[3px] border border-signal/30 bg-signal/5 px-3 py-2 text-sm text-signal">{error}</p>}
      <button type="submit" disabled={pending} className="btn btn-primary w-full sm:w-auto">{pending ? 'Publishing…' : 'Publish'}</button>
    </form>
  );
}
