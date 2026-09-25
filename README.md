# LanceNest

**Veteran Jobs. Built for What’s Next.**

The career platform for active duty, transitioning, and veteran service members — combining a professional
profile, a job board, and military-to-civilian skill translation.

Stack: **Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, Storage)**

---

## Build status (Phase 1 — Foundation)

| Area | Status |
|---|---|
| Next.js + TypeScript + Tailwind, brand design system | ✅ Done |
| Full database schema (27 tables), RLS, indexes, storage buckets | ✅ Done — tested against Postgres |
| Auth: sign up (role choice), log in, log out, forgot/reset password, email verification | ✅ Done |
| Protected routes (middleware) + server-side role checks (layouts) | ✅ Done |
| Landing page, About, For Employers (plans), 404, error, loading states | ✅ Done |
| Job search + filters, job detail, Save Job, Apply, Share | ✅ Done (early Phase 3) |
| Public company pages, MOS → civilian translator | ✅ Done |
| Veteran / employer / admin dashboards (real data) | ✅ Foundation done |
| Seed data: 20 occupations, 24 skills, 10 companies, 30 jobs, 12 demo accounts | ✅ Done |

**Next up (in order):** Phase 2 veteran onboarding + full profile editing + resume upload →
Phase 3 applications tracker & saved-jobs pages → Phase 4 employer job posting & candidate search →
Phase 5 messaging & notifications → Phase 6 matching engine → Phase 7 admin verification & moderation →
Phase 8 Stripe billing.

### Security properties (verified by tests against the schema)
- Nobody can sign up as an admin — signup metadata can only produce `veteran` or `employer`.
- Users cannot change their own `role`, mark themselves verified, upgrade their company plan, or feature their own jobs (column-level privileges).
- Applicants can only apply or withdraw; only the hiring company moves an application through the pipeline.
- Every application status change is logged automatically.
- Private veteran profiles are hidden from anonymous visitors; resumes and verification documents are owner-only.
- Admin pages check the role server-side **before** using the service-role key.
- Login redirects only allow same-site paths (no open redirects).

---

## 1. Create the Supabase project

Use a **new** Supabase project for this version — the schema is not compatible with the earlier prototype’s tables.

1. supabase.com → **New project**. Save the database password somewhere safe.
2. **SQL Editor → New query** → paste all of `supabase/migrations/0001_schema.sql` → **Run**.
3. **SQL Editor → New query** → paste all of `supabase/migrations/0002_security_hardening.sql` → **Run**
   (moves helper functions out of the public API; clears Supabase’s security-advisor warnings).
4. **SQL Editor → New query** → paste all of `supabase/seed.sql` → **Run** (optional but recommended for development).
5. **Authentication → URL Configuration**
   - **Site URL:** your production URL (e.g. `https://lancenest.com`)
   - **Redirect URLs:** add
     - `http://localhost:3000/**`
     - `https://*-your-vercel-team.vercel.app/**` (preview deployments)
     - `https://lancenest.com/**`
6. **Authentication → SMTP Settings** → connect Resend (host `smtp.resend.com`, port `465`, user `resend`,
   password = your Resend API key, sender `noreply@lancenest.com`).
   Supabase’s built-in mailer only delivers to your own team’s addresses, so real signups need custom SMTP.
7. **Project Settings → API** → copy the Project URL, the anon/publishable key, and the service role/secret key.

### Admin two-step login
Admin pages require an authenticator-app code (Supabase MFA, TOTP). The first time an admin visits `/admin`
they're sent to `/security/mfa` to set it up. Admin powers in the database also require the two-step session.
**Lost your phone?** Remove the factor in the SQL Editor, then set it up again:

```sql
delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'you@example.com');
```

### Make yourself an admin
Sign up through the site normally, confirm your email, then run in the SQL Editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
delete from public.veteran_profiles
where profile_id = (select id from auth.users where email = 'you@example.com');
```

### Demo network activity (currently live)
`supabase/demo_network.sql` adds 10 fictional, display-only members (no password; they cannot log in) with
milestone posts, reactions, comments, and follows so the Network feed looks active before launch. Each demo bio
says it's a fictional member. **Remove all of it before inviting real users** with one command in the SQL Editor:

```sql
delete from auth.users where raw_app_meta_data ->> 'demo' = 'true';
```

---

## 2. Environment variables

Copy `.env.example` to `.env.local` (local) and add the same values in Vercel → Project → Settings → Environment Variables.

| Variable | Where it comes from | Exposed to browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API (anon / publishable) | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (service role / secret) | **never** |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally, `https://lancenest.com` in production | yes |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key (secret key goes in Supabase → Auth → Attack Protection) | yes |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Phase 8 — leave empty for now | no |
| `DEMO_PASSWORD` | Your choice (12+ chars), local demo accounts only | no |

Never commit `.env.local`. It is already in `.gitignore`.

---

## 3. Run locally (optional)

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

Other scripts: `npm run build`, `npm run lint`, `npm run typecheck`.

### Demo accounts (development only)
After running `supabase/seed.sql`, set `DEMO_PASSWORD` in `.env.local` and run:

```bash
npm run seed:users
```

This creates (all passwords = your `DEMO_PASSWORD`):

| Account | Role |
|---|---|
| `demo-veteran@lancenest.local` | Veteran (verified, Army 11B) |
| `demo-employer@lancenest.local` | Employer (owns *Harborline Defense Group*) |
| `demo-admin@lancenest.local` | Admin |
| `veteran1…9@lancenest.local` | Nine fictional veteran profiles |

The script refuses to run if `NEXT_PUBLIC_SITE_URL` points at lancenest.com. All seed people and companies are fictional.

---

## 4. Deploy to production (Vercel)

Recommended path: deploy this as a **new** project, test it on its `*.vercel.app` URL, then move the domain.

1. Create a new GitHub repository (e.g. `lancenest-app`) and upload this folder’s contents
   (GitHub Desktop is easiest for a whole project; `node_modules/` and `.next/` are not needed).
2. vercel.com → **Add New → Project** → import the repo. Framework: Next.js (auto-detected).
3. Add the environment variables from section 2 (use the `*.vercel.app` URL for `NEXT_PUBLIC_SITE_URL` at first).
4. Deploy, then test: sign up → confirm email → log in → dashboard → search jobs → save → apply → log out.
5. When it’s right: Vercel → old project → Domains → remove `lancenest.com`; new project → Domains → add it.
   Update `NEXT_PUBLIC_SITE_URL` and the Supabase Site URL to `https://lancenest.com`, then redeploy.

---

## 5. How it’s put together

```
src/
  app/                    Routes (App Router)
    (auth pages)          login, signup, forgot-password, reset-password, account-setup
    auth/                 server actions + /auth/callback (email links)
    jobs/(list)/          job search (route group keeps the skeleton off detail pages)
    jobs/[slug]/          job detail — save, apply, share
    companies/[slug]/     public company page
    resources/            MOS → civilian translator
    dashboard/            veteran area      (layout: requireRole(['veteran']))
    employer/             employer area     (layout: requireRole(['employer']))
    admin/                admin area        (layout: requireRole(['admin']))
  components/             Navbar, Footer, JobCard, CompanyMark, VerificationBadge, EmptyState, …
  lib/
    supabase/             server, browser, admin (service role), middleware clients
    auth.ts               getSessionProfile, requireRole, roleHome, safeNextPath
    jobs.ts               job search queries
    format.ts             labels, salary formatting, slugify, search sanitizing
  middleware.ts           session refresh + signed-out redirect for protected areas
supabase/
  migrations/0001_schema.sql
  seed.sql
scripts/seed-users.mjs
```

**Authentication.** Supabase Auth with cookie-based sessions via `@supabase/ssr`. Auth is checked on the
server (`getUser()` validates the token), so pages never wait on client-side auth listeners.
Two layers guard protected areas: middleware (signed-out → `/login?next=…`) and a server-side
`requireRole` in each area’s layout (wrong role → that user’s own home).

**Storage.** Buckets: `avatars` and `company-logos` (public), `resumes` and `verification-docs` (private).
Files go under a folder named for the uploader’s user id; storage policies enforce that. Employers will
view applicant resumes through short-lived signed URLs generated server-side (Phase 3/4).

**Military → civilian translation.** Lives in the `military_occupations` table, not in the UI. Add a
row to add an occupation — no code change or deploy. The O*NET Military Crosswalk
(onetonline.org/crosswalk/MOC) is a good source for expanding coverage.

**Job matching (Phase 6).** Scores will be computed server-side and stored in `job_matches` with a
`factors` JSON breakdown (military experience, skills, experience, location, education), so every
percentage is explainable and the algorithm can evolve without schema changes.

---

## 6. Future integrations

**Stripe (Phase 8).** Plans already exist in the data model (`companies.plan`, `subscriptions` with Stripe
customer/subscription ids). Users cannot change their own plan. Billing will add a checkout server action,
a webhook route that updates `subscriptions` + `companies.plan` with the service role, and a billing tab
in the employer dashboard.

**Veteran verification.** The workflow is modeled now: `veteran_profiles.verification_status`
(`not_verified → pending → verified | failed`) and `verification_requests` (with `method`, private
document path, reviewer, and timestamps). Users cannot set their own status. Phase 7 adds the upload
form and the admin review queue (manual DD-214 review). A third-party provider can later be added as a
new `method` without changing the rest of the system.
