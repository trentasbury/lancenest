import Link from 'next/link';
import FormMessage from '../FormMessage';

const MESSAGES: Record<string, string> = {
  required: 'A job title and overview are required.',
  salary: 'The maximum salary can’t be lower than the minimum.',
  save: 'That didn’t save. Please try again.',
};

export default function JobErrors({ error, saved }: { error?: string; saved?: string }) {
  if (error === 'limit') {
    return (
      <div className="card border-brass p-5">
        <p className="font-medium">The Free plan includes 2 open job posts.</p>
        <p className="mt-1 text-sm text-muted">Close one, add an extra slot for $39/month, or upgrade for unlimited posts. Saved drafts don’t count.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <form action="/api/billing/checkout" method="post"><input type="hidden" name="product" value="job_slot" /><button className="btn btn-outline">Add a slot · $39/mo</button></form>
          <Link href="/employers" className="btn btn-primary">See plans</Link>
        </div>
      </div>
    );
  }
  if (error) return <FormMessage error={MESSAGES[error] ?? MESSAGES.save} />;
  if (saved) return <FormMessage message="Saved." />;
  return null;
}
