# Lancenest — setup, exact steps

10% flat commission, charged automatically at payout via Stripe Connect.

## 1. Install
```
npm install
cp .env.local.example .env.local
```

## 2. Supabase (database + login)
1. Go to supabase.com → New project (free tier)
2. Settings → API → copy the Project URL, `anon` key, and `service_role` key into `.env.local`
3. SQL Editor → New query → paste everything in `supabase/schema.sql` → Run
4. Authentication → Providers → make sure Email is enabled (it is by default)

## 3. Stripe (payments + commission split)
1. dashboard.stripe.com → create account
2. Settings → Connect → turn on Connect, choose "Express" accounts (fastest onboarding for freelancers)
3. Developers → API keys → copy the Secret key and Publishable key into `.env.local`
4. Developers → Webhooks → Add endpoint → `https://yourdomain.com/api/webhooks/stripe`
   Select events: `checkout.session.completed`, `account.updated`
   Copy the signing secret into `STRIPE_WEBHOOK_SECRET`

## 4. Run it locally
```
npm run dev
```
Open localhost:3000. Sign up as a freelancer, connect Stripe (test mode), then sign up as a client (different browser or incognito) and hire yourself to test the full flow. Use Stripe test card `4242 4242 4242 4242`, any future date, any CVC.

## 5. Deploy
1. Push this folder to a new GitHub repo
2. vercel.com → New Project → import the repo
3. Add all the same `.env.local` variables in Vercel's Environment Variables settings
4. Deploy — you get a live URL immediately
5. Point your domain at it under Vercel → Domains

## How the money moves
- Client pays the full job amount on Stripe Checkout
- Stripe automatically splits it: your `PLATFORM_COMMISSION_PERCENT` stays in your Stripe balance, the rest transfers straight to the freelancer's connected account
- You never touch the freelancer's money directly — Stripe Connect handles the compliance/tax side (1099s, etc.) for you

## What's built
- Signup/login (freelancer or client)
- Public freelancer directory (`/directory`) — indexable by Google
- Freelancer profile pages with portfolio + reviews
- Hire flow → Stripe Checkout with automatic 10% commission split
- Freelancer dashboard to edit profile and connect Stripe payouts
- Review system after job completion

## What's not built yet (add when you need it)
- In-app messaging UI (the `messages` table exists in the schema — just needs a page)
- Portfolio item upload UI (table exists, needs a form + image upload to Supabase Storage)
- Dispute handling — for now, resolve manually via email until volume demands more
- Search/filter on the directory — add a simple text input filtering by skill once you have enough profiles for it to matter
