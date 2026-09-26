import Link from 'next/link';

export default function Upsell({ title, body, plan = 'Professional' }: { title: string; body: string; plan?: 'Professional' | 'Federal' }) {
  const product = plan === 'Federal' ? 'employer_federal_month' : 'employer_professional_month';
  return (
    <div className="card border-brass p-8 text-center">
      <p className="eyebrow">{plan} feature</p>
      <p className="mt-3 font-serif text-3xl">{title}</p>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted">{body}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <form action="/api/billing/checkout" method="post"><input type="hidden" name="product" value={product} /><button className="btn btn-primary">Upgrade to {plan} · {plan === 'Federal' ? '$499' : '$149'}/mo</button></form>
        <Link href="/employers" className="btn btn-outline">Compare plans</Link>
      </div>
    </div>
  );
}
