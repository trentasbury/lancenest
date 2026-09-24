import Link from 'next/link';

export default function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-[4px] border border-dashed border-brass/50 bg-paper px-6 py-10 text-center">
      <p className="font-serif text-xl text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{body}</p>
      {action && (
        <Link href={action.href} className="btn btn-outline mt-5">
          {action.label}
        </Link>
      )}
    </div>
  );
}
