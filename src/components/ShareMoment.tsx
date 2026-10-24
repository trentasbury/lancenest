/**
 * One-tap LinkedIn post for a big moment (verified, hired). LinkedIn's share link carries only our page address,
 * so nothing about the member's unit, base or employer is included: they write their own words, if any.
 */
export default function ShareMoment({ title, body }: { title: string; body: string }) {
  const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://www.lancenest.com/')}`;
  return (
    <div className="card flex flex-col gap-3 border-brass/40 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="font-semibold text-navy">{title}</p><p className="mt-1 text-sm text-muted">{body}</p></div>
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-outline shrink-0">Share on LinkedIn ↗</a>
    </div>
  );
}
