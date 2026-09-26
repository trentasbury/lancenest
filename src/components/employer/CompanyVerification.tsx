import SubmitButton from '../SubmitButton';
import { submitCompanyVerification } from '@/app/employer/actions';

export default function CompanyVerification({ status, note, flash }: { status: string; note: string | null; flash?: string }) {
  if (status === 'verified') return null;
  if (status === 'pending') {
    return (
      <section className="card border-brass p-6">
        <p className="eyebrow">Company verification · in review</p>
        <p className="mt-2 text-sm text-muted">We’re reviewing your company, usually within one business day. You can write draft jobs now — they publish as soon as you’re approved.</p>
      </section>
    );
  }
  return (
    <section className="card border-brass p-6">
      <p className="eyebrow">Verify your company</p>
      <p className="mt-2 text-sm text-muted">
        To protect veterans from fake recruiters, every company is verified before it can publish jobs, search candidates, message veterans, or buy a plan.
        {status === 'rejected' && note && <span className="mt-2 block text-signal">Last review: {note}</span>}
      </p>
      {flash === 'invalid' && <p className="mt-2 text-sm text-signal">Add your company website (starting with https://), your role, and confirm the statement.</p>}
      <form action={submitCompanyVerification} className="mt-5 grid gap-4 sm:grid-cols-2">
        <div><label className="field-label" htmlFor="website">Company website</label><input id="website" name="website" type="url" required placeholder="https://yourcompany.com" className="field" /></div>
        <div><label className="field-label" htmlFor="role">Your title</label><input id="role" name="role" required placeholder="e.g. Talent Acquisition Manager" className="field" /></div>
        <div><label className="field-label" htmlFor="linkedin">Company LinkedIn page (optional)</label><input id="linkedin" name="linkedin" className="field" /></div>
        <div><label className="field-label" htmlFor="ein">EIN (optional, speeds up review)</label><input id="ein" name="ein" placeholder="12-3456789" className="field" /></div>
        <div><label className="field-label" htmlFor="phone">Business phone (optional)</label><input id="phone" name="phone" className="field" /></div>
        <div><label className="field-label" htmlFor="state">State where the business is registered</label><input id="state" name="state" maxLength={2} placeholder="FL" className="field uppercase" /></div>
        <div><label className="field-label" htmlFor="state_id">State business ID / document number (optional)</label><input id="state_id" name="state_id" placeholder="e.g. L24000123456" className="field" /></div>
        <div className="sm:col-span-2"><label className="field-label" htmlFor="uei">SAM.gov UEI (federal contractors, optional)</label><input id="uei" name="uei" maxLength={12} placeholder="12-character Unique Entity ID" className="field uppercase" /></div>
        <p className="text-xs text-muted sm:col-span-2">New company? No problem — a person reviews it, usually within one business day. Your state business ID or SAM.gov UEI makes that review fastest.</p>
        <p className="self-end text-xs text-muted">If your login email is at your company’s domain (for example you@yourcompany.com), you’re approved instantly. Otherwise we review it by hand, usually within one business day.</p>
        <label className="flex items-start gap-2.5 text-sm sm:col-span-2">
          <input type="checkbox" name="attest" required className="mt-0.5 h-4 w-4 accent-navy" />
          I’m authorized to recruit for this company, and every job we post will be real and lawful.
        </label>
        <div className="sm:col-span-2"><SubmitButton className="btn btn-primary" pendingText="Submitting…">Submit for verification</SubmitButton></div>
      </form>
    </section>
  );
}
