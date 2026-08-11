# Clerk: Development → Production migration

**Status (2026-08-10): BLOCKED on owning a domain.** Production Clerk
instances require DNS records on a domain you control. `courtside.net` was
never purchased — its nameservers point to afternic.com (a domain
marketplace), so it is parked/for sale by a third party. The app runs on
`courtside-net.vercel.app`, and Clerk production cannot run on a
`.vercel.app` subdomain.

Everything below is ready to execute the day a domain exists. Total time
once unblocked: roughly an hour, plus DNS propagation.

## Why this migration matters

Production currently runs the Clerk **development** instance (`pk_test_…` in
Vercel). Dev instances show a "Development mode" banner on sign-in, cap
users, use shared OAuth credentials, and have weaker session handling. All
9 real users live there as "test users."

Every user-content table references `profiles.clerk_user_id` — the raw
Clerk id. Production Clerk issues **new ids**, so switching keys without
remapping would give every existing user an empty account. The script
`scripts/migrate-clerk-to-prod.ts` handles this (see step 5).

## Steps

### 1. Buy a domain (Scott)
courtside.net is on the aftermarket (likely expensive). Alternatives:
courtside.app / courtside.tennis / getcourtside.com etc. Add the domain to
the Vercel project (Project → Settings → Domains) so the site serves on it.

### 2. Create the production instance (Clerk dashboard)
Dashboard → Courtside.Net app → environment picker → "Go to prod" /
"Create production instance". It clones the dev config. Enter the new
domain. Clerk then shows ~5 DNS records (frontend API, accounts portal,
email DKIM). Add them wherever the domain's DNS is managed and wait for
Clerk to verify + issue certificates.

### 3. OAuth credentials (production requires your own)
- **Google** (most of the 9 users signed in with it): create an OAuth
  client in Google Cloud Console → paste client id/secret into Clerk's
  Google connection. Without this, Google sign-in will not work in prod.
- **Apple / X**: need an Apple Developer account ($99/yr) / X developer
  app. Fine to disable both at first — email code works with zero setup.

### 4. Swap keys + webhook (Vercel)
- Copy the prod `pk_live_…` / `sk_live_…` into the Vercel project env
  (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`). Keep the
  `pk_test`/`sk_test` keys in `.env.local` — local dev stays on the dev
  instance.
- Clerk dashboard (prod) → Webhooks → add endpoint
  `https://<domain>/api/webhooks/clerk` → subscribe to
  `user.created`, `user.updated`, `user.deleted` → copy the new
  `whsec_…` into Vercel `CLERK_WEBHOOK_SECRET`.
- Redeploy.

### 5. Migrate the users + remap Supabase
```bash
npx tsx scripts/migrate-clerk-to-prod.ts            # dry run: lists dev users
export CLERK_PROD_SECRET_KEY=sk_live_...
npx tsx scripts/migrate-clerk-to-prod.ts --apply    # creates prod users, writes SQL
```
Then open the Supabase SQL editor and run
`scripts/output/clerk-id-remap.sql`. It converts the FKs on
`profiles(clerk_user_id)` to `ON UPDATE CASCADE` and updates each profile
to its new Clerk id — reviews, ratings, follows, comments, watch history,
and achievements all follow.

Note: the webhook will fire `user.created` for each imported user and try
to insert a profile; the insert fails on the unique `username`/
`clerk_user_id` constraints once the remap has run, which is harmless —
but run the SQL remap promptly after `--apply` to close the window where a
duplicate profile could be created. If any `user_…` duplicate profiles
appear in `profiles` afterwards, delete them (they'll have zero content).

### 6. Smoke test
- Sign in on the production domain with your own account (email code) —
  profile, reviews, and honours must all be intact.
- Check the "Development mode" banner is gone.
- Have one friend sign in with Google (after step 3) and confirm their
  catalogue survived.
