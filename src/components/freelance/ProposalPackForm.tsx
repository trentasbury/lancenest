/** "Buy 5 more proposals" for Free freelancers: starts a one-time $5 Stripe checkout, then returns to `back`. */
export default function ProposalPackForm({ back, button = false }: { back: string; button?: boolean }) {
  return (
    <form action="/api/billing/checkout" method="post">
      <input type="hidden" name="product" value="proposal_pack" />
      <input type="hidden" name="back" value={back} />
      <button className={button ? 'btn btn-primary w-full' : 'text-navy underline hover:text-brass-dark'}>
        {button ? 'Get 5 more proposals · $5' : 'Buy 5 more · $5'}
      </button>
    </form>
  );
}
